import { Injectable, Logger, BadRequestException } from '@nestjs/common';

export interface WordPressMediaUploadResult {
  id: number;
  sourceUrl: string;
}

export interface WordPressPublishResult {
  wpPostId: number;
  wpUrl: string;
  wpStatus: string;
}

@Injectable()
export class WpPublisherService {
  private readonly logger = new Logger(WpPublisherService.name);

  /**
   * Downloads an image from a URL and uploads it directly to the WordPress Media Library.
   */
  async uploadMediaFromUrl(
    siteUrl: string,
    authHeader: string,
    imageUrl: string,
    title: string,
    altText?: string,
  ): Promise<WordPressMediaUploadResult | null> {
    try {
      this.logger.log(`[MediaUpload] 📥 Downloading image bytes from: ${imageUrl}`);
      const imageResponse = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
          Accept: 'image/*',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!imageResponse.ok) {
        this.logger.warn(`[MediaUpload] ❌ Failed to download image from ${imageUrl}: HTTP ${imageResponse.status} ${imageResponse.statusText}`);
        return null;
      }

      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const buffer = await imageResponse.arrayBuffer();
      const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.jpg`;

      const uploadUrl = `${siteUrl}/wp-json/wp/v2/media`;
      this.logger.log(`[MediaUpload] 📤 Image downloaded (${Math.round(buffer.byteLength / 1024)} KB). Uploading to WordPress Media Library: ${uploadUrl}`);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
        body: buffer,
        signal: AbortSignal.timeout(20000),
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => '');
        this.logger.warn(`WordPress media upload failed: HTTP ${uploadResponse.status} - ${errorText}`);
        return null;
      }

      const mediaData: any = await uploadResponse.json();
      const mediaId = mediaData.id;

      // Update alt_text if provided
      if (altText && mediaId) {
        await fetch(`${uploadUrl}/${mediaId}`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ alt_text: altText }),
        }).catch(() => null);
      }

      return {
        id: mediaId,
        sourceUrl: mediaData.source_url || mediaData.guid?.rendered || imageUrl,
      };
    } catch (err: any) {
      this.logger.warn(`Error during WordPress media upload: ${err.message}`);
      return null;
    }
  }

  /**
   * Publishes a post to WordPress via REST API.
   */
  async publishPost(
    siteUrl: string,
    authHeader: string,
    restNamespace: string,
    restBase: string,
    payload: {
      title: string;
      content: string;
      excerpt?: string;
      status?: 'publish' | 'draft' | 'pending';
      featured_media?: number;
      categories?: number[];
      tags?: number[];
      acf?: Record<string, any>;
    },
  ): Promise<WordPressPublishResult> {
    const targetUrl = `${siteUrl}/wp-json/${restNamespace}/${restBase}`;
    this.logger.log(`Publishing post to WordPress: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.logger.error(`WordPress post creation failed: HTTP ${response.status} - ${errorText}`);
      throw new BadRequestException(`Failed to publish post on WordPress: HTTP ${response.status} - ${errorText}`);
    }

    const result: any = await response.json();
    return {
      wpPostId: result.id,
      wpUrl: result.link || `${siteUrl}/?p=${result.id}`,
      wpStatus: result.status || payload.status || 'publish',
    };
  }
}
