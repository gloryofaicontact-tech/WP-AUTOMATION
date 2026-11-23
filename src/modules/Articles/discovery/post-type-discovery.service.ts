import { Injectable, Logger, BadRequestException } from '@nestjs/common';

export interface DiscoveredPostType {
  slug: string;
  name: string;
  description: string | null;
  restNamespace: string;
  restBase: string;
  hierarchical: boolean;
  supports: Record<string, boolean>;
  taxonomies: string[];
}

@Injectable()
export class PostTypeDiscoveryService {
  private readonly logger = new Logger(PostTypeDiscoveryService.name);

  // Blacklist of post types that must NOT be managed as editorial content
  private readonly EXCLUDED_POST_TYPES = new Set([
    'page',                 // Ordinary WordPress pages
    'attachment',           // Media library items
    'revision',             // Post revisions
    'nav_menu_item',        // Menu items
    'custom_css',           // WordPress customizer CSS
    'customize_changeset',  // Customizer state
    'oembed_cache',         // Embed caches
    'user_request',         // Privacy export/erase requests
    'wp_block',             // Reusable blocks
    'wp_template',          // Site editor templates
    'wp_template_part',     // Template parts
    'wp_navigation',        // Navigation menus
    'wp_font_family',       // Font assets
    'wp_font_face',         // Font faces
    'action_monitor',       // System monitor logs
  ]);

  /**
   * Discovers all available post types from a WordPress site.
   */
  async discover(url: string, authHeader: string): Promise<DiscoveredPostType[]> {
    const endpoint = `${url}/wp-json/wp/v2/types?context=edit`;
    this.logger.log(`Discovering post types from ${endpoint}`);

    let response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    // If context=edit is restricted (401 Unauthorized, 403 Forbidden, etc.), fall back to standard /wp-json/wp/v2/types
    if (!response.ok) {
      this.logger.warn(`Endpoint /types?context=edit returned HTTP ${response.status} on ${url}. Falling back to public /types endpoint.`);
      response = await fetch(`${url}/wp-json/wp/v2/types`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.logger.error(`WordPress post type discovery failed on ${url}: HTTP ${response.status} - ${errorText}`);
      throw new BadRequestException(
        `WordPress returned HTTP ${response.status} when discovering post types on ${url}: ${response.statusText}. Please verify that the WordPress REST API is accessible.`,
      );
    }

    const typesMap: Record<string, any> = await response.json();
    const discovered: DiscoveredPostType[] = [];

    for (const [slug, rawType] of Object.entries(typesMap)) {
      if (this.isExcluded(slug, rawType)) {
        continue;
      }

      const restNamespace = rawType.rest_namespace || 'wp/v2';
      const restBase = rawType.rest_base || slug;

      discovered.push({
        slug,
        name: rawType.name || slug,
        description: rawType.description || null,
        restNamespace,
        restBase,
        hierarchical: Boolean(rawType.hierarchical),
        supports: typeof rawType.supports === 'object' && rawType.supports !== null ? rawType.supports : {},
        taxonomies: Array.isArray(rawType.taxonomies) ? rawType.taxonomies : [],
      });
    }

    this.logger.log(`Discovered ${discovered.length} eligible post types for ${url}: ${discovered.map((t) => t.slug).join(', ')}`);
    return discovered;
  }

  private isExcluded(slug: string, rawType: any): boolean {
    const s = slug.toLowerCase();

    // 1. Explicitly excluded core/system post types
    if (this.EXCLUDED_POST_TYPES.has(s)) return true;

    // 2. WordPress core internal prefixes
    if (s.startsWith('wp_')) return true;

    // 3. Jetpack internal utilities, logs, and payment orders
    if (s.startsWith('jp_') || s.startsWith('jetpack_') || s === 'feedback') return true;

    // 4. Page builder internals (Elementor, Divi, Beaver Builder, etc.)
    if (
      s.startsWith('elementor_') ||
      s.startsWith('e-') ||
      s.startsWith('et_') ||
      s.startsWith('fl-') ||
      s.includes('template')
    ) {
      return true;
    }

    // 5. Form builders & submissions (SureForms, Contact Form 7, WPForms, Ninja, Gravity)
    if (s.includes('form') || s.includes('submission') || s.startsWith('srfm_')) {
      return true;
    }

    // 6. SEO plugin utility types (RankMath, Yoast, AIOSEO)
    if (s.startsWith('rm_') || s.startsWith('yoast_') || s.startsWith('aioseo_')) {
      return true;
    }

    // 7. System logs, orders, and payment records
    if (
      s.includes('_log') ||
      s.includes('order') ||
      s.includes('payment') ||
      s.includes('invoice') ||
      s.includes('transaction')
    ) {
      return true;
    }

    // 8. Must be exposed in the REST API
    if (rawType.show_in_rest === false) return true;

    return false;
  }
}
