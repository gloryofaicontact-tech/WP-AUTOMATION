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

    this.logger.log(`Discovering media assets for ${placeholders.length} layout placeholders...`);

    const matchedPlaceholders = await Promise.all(
      placeholders.map(async (placeholder) => {
        let assets = await this.envatoProvider.searchPhotos(placeholder.recommendedSearch, 4, envatoToken);

        if (!assets || assets.length === 0) {
          this.logger.debug(
            `Envato had no results for "${placeholder.recommendedSearch}". Falling back to stock provider...`,
          );
          assets = await this.stockFallbackProvider.searchPhotos(placeholder.recommendedSearch, 4);
        }

        const selectedAsset = assets[0];
        const alternativeOptions = assets.slice(1);

        return {
          placeholderId: placeholder.placeholderId,
          position: placeholder.position,
          recommendedSearch: placeholder.recommendedSearch,
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
