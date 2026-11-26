import { Injectable, Logger } from '@nestjs/common';

export interface WordPressConnectionTestResult {
  success: boolean;
  siteName?: string;
  siteDescription?: string;
  siteUrl?: string;
  user?: {
    id: number;
    name: string;
    slug: string;
    roles: string[];
  };
  restApiUrl: string;
  error?: string;
}

@Injectable()
export class WordPressClientService {
  private readonly logger = new Logger(WordPressClientService.name);

  /**
   * Normalizes a website URL by trimming, ensuring protocol, and removing trailing slashes.
   */
  normalizeUrl(rawUrl: string): string {
    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return url.replace(/\/+$/, '');
  }

  /**
   * Builds the WordPress REST API base URL.
   */
  getRestApiBase(normalizedUrl: string): string {
    return `${normalizedUrl}/wp-json/wp/v2`;
  }

  /**
   * Creates HTTP Basic Auth header for WordPress Application Passwords.
   */
  private getAuthHeader(username: string, applicationPassword: string): string {
    // Strip any accidental spaces users copy from WordPress application password UI (e.g. "abcd efgh ijkl")
    const cleanPassword = applicationPassword.replace(/\s+/g, '');
    const credentials = `${username}:${cleanPassword}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  /**
   * Tests connection to a WordPress site using Application Passwords.
   * 1. Fetches site info from `/wp-json`
   * 2. Verifies authentication and permissions from `/wp-json/wp/v2/users/me`
   */
  async testConnection(params: {
    url: string;
    username: string;
    applicationPassword: string;
  }): Promise<WordPressConnectionTestResult> {
    const normalizedUrl = this.normalizeUrl(params.url);
    const restApiUrl = this.getRestApiBase(normalizedUrl);
    const authHeader = this.getAuthHeader(params.username, params.applicationPassword);

    try {
      // Step 1: Probe /wp-json to verify this is a real WordPress site with REST API enabled
      let siteName = '';
      let siteDescription = '';
      let siteUrl = normalizedUrl;

      const rootResponse = await fetch(`${normalizedUrl}/wp-json`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!rootResponse.ok) {
        return {
          success: false,
          restApiUrl,
          error: `Could not reach WordPress REST API at ${normalizedUrl}/wp-json (HTTP ${rootResponse.status}). Please enter a valid WordPress site URL.`,
        };
      }

      let rootData: any;
      try {
        rootData = await rootResponse.json();
      } catch {
        return {
          success: false,
          restApiUrl,
          error: `The URL "${normalizedUrl}" is not a valid WordPress site (/wp-json did not return JSON).`,
        };
      }

      const namespaces: string[] = Array.isArray(rootData?.namespaces) ? rootData.namespaces : [];
      if (!namespaces.includes('wp/v2') && !rootData?.routes?.['/wp/v2']) {
        return {
          success: false,
          restApiUrl,
          error: `The URL "${normalizedUrl}" does not expose the WordPress wp/v2 REST API.`,
        };
      }

      siteName = rootData.name || '';
      siteDescription = rootData.description || '';
      siteUrl = rootData.url || normalizedUrl;

      // Step 2: Validate Application Password credentials via /wp-json/wp/v2/users/me?context=edit
      const userMeUrl = `${restApiUrl}/users/me?context=edit`;
      const response = await fetch(userMeUrl, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let detailedError = `HTTP ${response.status} ${response.statusText}`;
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed.message) {
            detailedError = parsed.message;
          }
        } catch {
          if (errorBody && errorBody.length < 200) {
            detailedError = errorBody;
          }
        }

        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            restApiUrl,
            error: `Authentication failed: ${detailedError}. Please check WordPress username and Application Password.`,
          };
        }

        return {
          success: false,
          restApiUrl,
          error: `WordPress REST API returned: ${detailedError}`,
        };
      }

      let userData: any;
      try {
        userData = await response.json();
      } catch {
        return {
          success: false,
          restApiUrl,
          error: `Unexpected non-JSON response from ${userMeUrl}. Please verify this is a valid WordPress site.`,
        };
      }

      if (!userData || typeof userData.id !== 'number') {
        return {
          success: false,
          restApiUrl,
          error: `Invalid WordPress user response from ${userMeUrl}.`,
        };
      }

      if (userData.capabilities && userData.capabilities.edit_posts === false) {
        return {
          success: false,
          restApiUrl,
          error: `WordPress user "${userData.name || params.username}" does not have permission to create or edit posts.`,
        };
      }

      return {
        success: true,
        siteName: siteName || userData.name,
        siteDescription,
        siteUrl,
        user: {
          id: userData.id,
          name: userData.name,
          slug: userData.slug,
          roles: userData.roles || [],
        },
        restApiUrl,
      };
    } catch (err: any) {
      this.logger.error(`WordPress connection test failed for ${normalizedUrl}: ${err.message}`);
      return {
        success: false,
        restApiUrl,
        error: `Could not connect to WordPress site at ${normalizedUrl}: ${err.message}`,
      };
    }
  }
}
