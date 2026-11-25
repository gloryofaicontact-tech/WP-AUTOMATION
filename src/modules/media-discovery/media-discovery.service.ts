import { Injectable, Logger } from '@nestjs/common';
import { EnvatoProvider } from './providers/envato.provider';
import { StockFallbackProvider } from './providers/stock-fallback.provider';
import { MatchedImagePlaceholder } from './interfaces/media-asset.interface';
import { ImagePlaceholder } from '../ai-engine/interfaces/image-placeholder.interface';
import { AiSettingsService } from '../ai-engine/settings/ai-settings.service';

@Injectable()
export class MediaDiscoveryService {
  private readonly logger = new Logger(MediaDiscoveryService.name);

  constructor(
    private readonly envatoProvider: EnvatoProvider,
    private readonly stockFallbackProvider: StockFallbackProvider,
    private readonly aiSettingsService: AiSettingsService,
  ) {}

  /**
   * Takes image placeholders recommended by the AI parser and discovers
   * matching high-resolution assets with thumbnail previews and alternate choices.
   */
  async discoverImagesForPlaceholders(
    placeholders: ImagePlaceholder[],
  ): Promise<MatchedImagePlaceholder[]> {
    if (!placeholders || placeholders.length === 0) {
      return [];
    }

    const effectiveKeys = await this.aiSettingsService.getEffectiveKeys();
    const envatoToken = effectiveKeys.envatoToken || undefined;

    this.logger.log(
      `[MediaDiscovery] 🚀 Processing ${placeholders.length} layout placeholders (Envato token configured: ${Boolean(envatoToken)})...`,
    );

    const matchedPlaceholders = await Promise.all(
      placeholders.map(async (placeholder, idx) => {
        this.logger.log(
          `[MediaDiscovery] Placeholder #${idx + 1} (${placeholder.position}): Querying Envato for "${placeholder.recommendedSearch}" (Fallback: "${placeholder.fallbackSearch || 'none'}")...`,
        );

        let assets = await this.envatoProvider.searchPhotos(
          placeholder.recommendedSearch,
          4,
          envatoToken,
          placeholder.fallbackSearch,
        );

        if (assets && assets.length > 0) {
          this.logger.log(
            `[MediaDiscovery] ✅ Envato returned ${assets.length} photos for "${placeholder.recommendedSearch}". Primary: "${assets[0].title}" (${assets[0].previewUrl.slice(0, 60)}...)`,
          );
        } else {
          this.logger.warn(
            `[MediaDiscovery] ⚠️ Envato had 0 assets for "${placeholder.recommendedSearch}". Falling back to stock provider...`,
          );
          assets = await this.stockFallbackProvider.searchPhotos(placeholder.recommendedSearch, 4);
        }

        const selectedAsset = assets[0];
        const alternativeOptions = assets.slice(1);

        return {
          placeholderId: placeholder.placeholderId,
          position: placeholder.position,
          recommendedSearch: placeholder.recommendedSearch,
          fallbackSearch: placeholder.fallbackSearch,
          altText: placeholder.altText,
          targetHeading: placeholder.targetHeading,
          selectedAsset,
          alternativeOptions,
        };
      }),
    );

    return matchedPlaceholders;
  }
}
