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
   * Helper to robustly extract high-resolution image URLs across all Envato preview schemas.
   */
  private extractImageUrl(item: any): string | null {
    // 1. Check top-level image_urls array (PhotoDune / Elements DAM portfolio manager)
    if (Array.isArray(item.image_urls) && item.image_urls.length > 0) {
      const w1000 =
        item.image_urls.find((img: any) => img.width >= 1000) ||
        item.image_urls[item.image_urls.length - 1];
      if (w1000?.url) return w1000.url;
    }

    // 2. Check icon_with_square_preview (GraphicRiver / Elements Mockups & Photos)
    const squarePreview = item.previews?.icon_with_square_preview;
    if (squarePreview) {
      if (Array.isArray(squarePreview.image_urls) && squarePreview.image_urls.length > 0) {
        const best =
          squarePreview.image_urls.find((img: any) => img.width >= 500) ||
          squarePreview.image_urls[0];
        if (best?.url) return best.url;
      }
      if (squarePreview.square_url) return squarePreview.square_url;
    }

    // 3. Check thumbnail_preview (large_url)
    if (item.previews?.thumbnail_preview?.large_url) {
      return item.previews.thumbnail_preview.large_url;
    }

    // 4. Check video preview landscape_url
    if (item.previews?.icon_with_video_preview?.landscape_url) {
      return item.previews.icon_with_video_preview.landscape_url;
    }

    // 5. Check icon_with_thumbnail_preview
    if (item.previews?.icon_with_thumbnail_preview?.thumbnail_url) {
      return item.previews.icon_with_thumbnail_preview.thumbnail_url;
    }

    // 6. Check classic landscape_preview
    if (item.previews?.landscape_preview?.landscape_url) {
      return item.previews.landscape_preview.landscape_url;
    }

    // 7. General search across all preview objects for any image URL
    if (item.previews && typeof item.previews === 'object') {
      for (const key of Object.keys(item.previews)) {
        const p = item.previews[key];
        if (p?.landscape_url) return p.landscape_url;
        if (p?.large_url) return p.large_url;
        if (p?.square_url) return p.square_url;
        if (p?.preview_url) return p.preview_url;
        if (p?.thumbnail_url) return p.thumbnail_url;
      }
    }

    return null;
  }

  /**
   * Cleans a search query by removing special characters, punctuation, and excess whitespace.
   */
  private sanitizeQuery(query: string): string {
    return query
      .replace(/[,;:.!?()[\]{}"'\\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generates a smart cascade of candidate search terms in priority order.
   * If a specific phrase or brand yields 0 hits, the waterfall tries broader terms.
   */
  private buildQueryCandidates(query: string, fallbackQuery?: string): string[] {
    const candidates: string[] = [];
    const seen = new Set<string>();

    const addCandidate = (cand: string | undefined | null) => {
      if (!cand) return;
      const cleaned = this.sanitizeQuery(cand);
      if (cleaned.length >= 3 && !seen.has(cleaned.toLowerCase())) {
        seen.add(cleaned.toLowerCase());
        candidates.push(cleaned);
      }
    };

    // 1. If query has commas or semicolons, extract individual sub-phrases
    if (query.includes(',') || query.includes(';')) {
      const parts = query.split(/[,;]+/).map((p) => p.trim());
      for (const part of parts) {
        addCandidate(part);
      }
    }

    // 2. Full sanitized query
    addCandidate(query);

    // 3. Fallback query if provided by AI
    if (fallbackQuery) {
      addCandidate(fallbackQuery);
    }

    // 4. Deconstruct multi-word phrases into high-volume 2-word & 3-word combinations
    const words = this.sanitizeQuery(query).split(' ').filter((w) => w.length > 1);
    if (words.length > 2) {
      addCandidate(words.slice(0, 2).join(' '));
      addCandidate(words.slice(-2).join(' '));
      if (words.length > 3) {
        addCandidate(words.slice(0, 3).join(' '));
      }
    }

    // 5. Filter out specific brand words if present (e.g. "liqui", "moly") to find generic photos
    const brandPattern = /\b(liqui\s*moly|toyota|bmw|mercedes|honda|audi|ford)\b/gi;
    if (brandPattern.test(query)) {
      const debranded = query.replace(brandPattern, '').replace(/\s+/g, ' ').trim();
      addCandidate(debranded);
    }

    return candidates;
  }

  /**
   * Searches Envato Elements / Market for high-resolution photo assets with smart multi-tier query fallback.
   */
  async searchPhotos(
    query: string,
    limit = 4,
    tokenOverride?: string,
    fallbackQuery?: string,
  ): Promise<DiscoveredImageAsset[]> {
    const activeToken = tokenOverride || this.apiToken;
    if (!activeToken) {
      this.logger.warn(`[Envato] No ENVATO_API_TOKEN provided. Envato search skipped for query: "${query}"`);
      return [];
    }

    const candidateQueries = this.buildQueryCandidates(query, fallbackQuery);
    this.logger.log(
      `[Envato] 🤖 Smart Search initiated for "${query}". Cascade candidates: [${candidateQueries.map((c) => `"${c}"`).join(', ')}]`,
    );

    for (let i = 0; i < candidateQueries.length; i++) {
      const currentQuery = candidateQueries[i];
      try {
        const cleanQuery = encodeURIComponent(currentQuery);
        const url = `https://api.envato.com/v1/discovery/search/search/item?term=${cleanQuery}&type=photo&page_size=${limit}`;

        this.logger.log(
          `[Envato] 🔎 Attempt ${i + 1}/${candidateQueries.length}: Querying Envato for "${currentQuery}" (Token: ${activeToken.slice(0, 5)}...${activeToken.slice(-4)})`,
        );

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          this.logger.warn(`[Envato] ❌ API search failed for "${currentQuery}": HTTP ${response.status} - ${errorText}`);
          continue;
        }

        const data: any = await response.json();
        const matches: any[] = data.matches || [];

        if (matches.length === 0 || (data.total_hits || 0) === 0) {
          this.logger.log(
            `[Envato] ℹ️ 0 hits for "${currentQuery}". Cascading to next candidate...`,
          );
          continue;
        }

        this.logger.log(
          `[Envato] ✅ Match found! Received ${matches.length} matches from Envato for "${currentQuery}" (Total hits: ${data.total_hits})`,
        );

        const validAssets: DiscoveredImageAsset[] = [];

        for (const item of matches) {
          const directImageUrl = this.extractImageUrl(item);
          if (!directImageUrl) {
            this.logger.debug(`[Envato] Skipping match #${item.id} - no valid image URL found in previews.`);
            continue;
          }

          validAssets.push({
            id: String(item.id),
            title: item.name || item.description || currentQuery,
            previewUrl: directImageUrl,
            sourceUrl: item.url || `https://elements.envato.com/items/${item.id}`,
            downloadUrl: directImageUrl,
            author: item.author_username || item.author_name || 'Envato Author',
            width: 1200,
            height: 800,
            provider: 'envato',
          });
        }

        if (validAssets.length > 0) {
          this.logger.log(
            `[Envato] 🎯 Extracted ${validAssets.length} valid high-res Envato image assets for "${currentQuery}".`,
          );
          return validAssets;
        }
      } catch (err: any) {
        this.logger.warn(`[Envato] ⚠️ Error during Envato search attempt for "${currentQuery}": ${err.message}`);
      }
    }

    this.logger.warn(
      `[Envato] ⚠️ All ${candidateQueries.length} candidate queries returned 0 results for original query "${query}".`,
    );
    return [];
  }
}
