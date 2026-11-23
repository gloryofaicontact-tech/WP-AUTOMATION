import { Injectable, Logger } from '@nestjs/common';

export interface DiscoveredTaxonomy {
  slug: string;
  name: string;
  description: string | null;
  restNamespace: string;
  restBase: string;
  hierarchical: boolean;
  types: string[]; // Post type slugs this taxonomy is associated with
}

@Injectable()
export class TaxonomyDiscoveryService {
  private readonly logger = new Logger(TaxonomyDiscoveryService.name);

  private readonly EXCLUDED_TAXONOMIES = new Set([
    'nav_menu',
    'wp_theme',
    'wp_template_part_area',
    'post_format',
  ]);

  /**
   * Discovers all registered taxonomies from WordPress.
   */
  async discover(url: string, authHeader: string): Promise<DiscoveredTaxonomy[]> {
    const endpoint = `${url}/wp-json/wp/v2/taxonomies?context=edit`;

    try {
      let response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) {
        this.logger.warn(`Endpoint /taxonomies?context=edit returned HTTP ${response.status} on ${url}. Attempting standard /taxonomies.`);
        response = await fetch(`${url}/wp-json/wp/v2/taxonomies`, {
          method: 'GET',
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(12000),
        });
      }

      if (!response.ok) {
        this.logger.warn(`Could not fetch taxonomies: HTTP ${response.status}`);
        return [];
      }

      const taxonomiesMap: Record<string, any> = await response.json();
      const discovered: DiscoveredTaxonomy[] = [];

      for (const [slug, rawTax] of Object.entries(taxonomiesMap)) {
        if (this.EXCLUDED_TAXONOMIES.has(slug) || slug.startsWith('wp_')) {
          continue;
        }

        discovered.push({
          slug,
          name: rawTax.name || slug,
          description: rawTax.description || null,
          restNamespace: rawTax.rest_namespace || 'wp/v2',
          restBase: rawTax.rest_base || slug,
          hierarchical: Boolean(rawTax.hierarchical),
          types: Array.isArray(rawTax.types) ? rawTax.types : [],
        });
      }

      return discovered;
    } catch (err: any) {
      this.logger.warn(`Taxonomy discovery skipped/failed for ${url}: ${err.message}`);
      return [];
    }
  }
}
