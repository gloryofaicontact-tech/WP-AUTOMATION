import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveredImageAsset } from '../interfaces/media-asset.interface';

@Injectable()
export class EnvatoProvider {
  private readonly logger = new Logger(EnvatoProvider.name);
  private readonly apiToken: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.apiToken = this.config.get<string>('ENVATO_API_TOKEN')?.trim();
    if (this.apiToken) {
      this.logger.log('EnvatoProvider initialized with ENVATO_API_TOKEN.');
    } else {
      this.logger.debug('ENVATO_API_TOKEN not set. EnvatoProvider will be bypassed.');
    }
  }

  isAvailable(tokenOverride?: string): boolean {
    return Boolean(tokenOverride || this.apiToken);
  }

  /**
   * Searches Envato Elements / Market for high-resolution photo assets.
   */
  async searchPhotos(query: string, limit = 4, tokenOverride?: string): Promise<DiscoveredImageAsset[]> {
    const activeToken = tokenOverride || this.apiToken;
    if (!activeToken) {
      return [];
    }

    try {
      const cleanQuery = encodeURIComponent(query.trim());
      const url = `https://api.envato.com/v1/discovery/search/search/item?term=${cleanQuery}&type=photo&page_size=${limit}`;

      this.logger.debug(`Searching Envato for: "${query}"`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'User-Agent': 'WP-Automation-Backend/1.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        this.logger.warn(`Envato API search failed: HTTP ${response.status} ${response.statusText}`);
        return [];
      }

      const data: any = await response.json();
      const matches: any[] = data.matches || [];

      return matches.map((item) => ({
        id: String(item.id),
        title: item.name || item.description || query,
        previewUrl: item.previews?.landscape_preview?.landscape_url || item.previews?.icon_with_landscape_preview?.landscape_url || item.thumbnail_url || '',
        sourceUrl: item.url || `https://elements.envato.com/items/${item.id}`,
        downloadUrl: item.previews?.landscape_preview?.landscape_url || item.url || '',
        author: item.author_username || item.author_name || 'Envato Author',
        width: item.previews?.landscape_preview?.width || 1200,
        height: item.previews?.landscape_preview?.height || 800,
        provider: 'envato',
      }));
    } catch (err: any) {
      this.logger.warn(`Envato search error for "${query}": ${err.message}`);
      return [];
    }
  }
}
