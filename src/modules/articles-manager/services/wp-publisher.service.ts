import { Injectable, Logger, BadRequestException } from '@nestjs/common';

export interface WordPressPublishResult {
  wpPostId: number;
  wpUrl: string;
  wpStatus: string;
}

@Injectable()
export class WpPublisherService {
  private readonly logger = new Logger(WpPublisherService.name);

  /**
   * Downloads an image from a URL and uploads it to WordPress Media Library.
   */
  async uploadMediaFromUrl(
    siteUrl: string,
    authHeader: string,
    imageUrl: string,
    title: string,
    altText?: string,
  ): Promise<{ id: number; sourceUrl: string } | null> {
    try {
      this.logger.log(`Downloading image from: ${imageUrl.slice(0, 80)}...`);

      const imgResponse = await fetch(imageUrl, {
        signal: AbortSignal.timeout(15000),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      if (!imgResponse.ok) {
        this.logger.warn(`Failed to download image from ${imageUrl}: HTTP ${imgResponse.status}`);
        return null;
      }

      const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await imgResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let extension = 'jpg';
      if (contentType.includes('png')) extension = 'png';
      else if (contentType.includes('webp')) extension = 'webp';

      const sanitizedSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 30);
      const filename = `${sanitizedSlug || 'featured-image'}-${Date.now()}.${extension}`;

      const uploadUrl = `${siteUrl}/wp-json/wp/v2/media`;
      this.logger.log(`Uploading ${buffer.length} bytes to WordPress Media: ${uploadUrl}`);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Type': contentType,
        },
        body: buffer,
        signal: AbortSignal.timeout(20000),
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => '');
        this.logger.error(`WordPress media upload failed: HTTP ${uploadResponse.status} - ${errorText}`);
        return null;
      }

      const mediaData: any = await uploadResponse.json();
      const mediaId = mediaData.id;

      if (altText && mediaId) {
        await fetch(`${siteUrl}/wp-json/wp/v2/media/${mediaId}`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            alt_text: altText,
            title: title,
          }),
        }).catch((err) => this.logger.warn(`Failed to update media alt text: ${err.message}`));
      }

      return {
        id: mediaId,
        sourceUrl: mediaData.source_url || mediaData.guid?.rendered || imageUrl,
      };
    } catch (err: any) {
      this.logger.error(`Error uploading media to WordPress: ${err.message}`);
      return null;
    }
  }

  /**
   * Publishes or updates a post to WordPress via REST API.
   * If wpPostId is supplied, updates existing post (e.g. unpublishing to 'draft' or republishing).
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
    wpPostId?: number,
  ): Promise<WordPressPublishResult> {
    const targetUrl = wpPostId
      ? `${siteUrl}/wp-json/${restNamespace}/${restBase}/${wpPostId}`
      : `${siteUrl}/wp-json/${restNamespace}/${restBase}`;

    this.logger.log(
      `${wpPostId ? `Updating post #${wpPostId}` : 'Publishing new post'} on WordPress: ${targetUrl} (Status: ${payload.status || 'publish'})`,
    );

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
      this.logger.error(`WordPress post operation failed: HTTP ${response.status} - ${errorText}`);
      throw new BadRequestException(
        `Failed to ${wpPostId ? 'update' : 'publish'} post on WordPress: HTTP ${response.status} - ${errorText}`,
      );
    }

    const result: any = await response.json();
    return {
      wpPostId: result.id,
      wpUrl: result.link || `${siteUrl}/?p=${result.id}`,
      wpStatus: result.status || payload.status || 'publish',
    };
  }

  /**
   * Deletes or trashes a post on WordPress via REST API.
   * force = false: moves to Trash (default).
   * force = true: permanently deletes.
   */
  async deletePost(
    siteUrl: string,
    authHeader: string,
    restNamespace: string,
    restBase: string,
    wpPostId: number,
    force = false,
  ): Promise<{ success: boolean; id: number; trashed: boolean }> {
    const targetUrl = `${siteUrl}/wp-json/${restNamespace}/${restBase}/${wpPostId}?force=${force}`;
    this.logger.log(`Deleting post #${wpPostId} on WordPress: ${targetUrl} (Force: ${force})`);

    const response = await fetch(targetUrl, {
      method: 'DELETE',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.logger.error(`WordPress post deletion failed: HTTP ${response.status} - ${errorText}`);
      throw new BadRequestException(
        `Failed to delete post on WordPress: HTTP ${response.status} - ${errorText}`,
      );
    }

    return {
      success: true,
      id: wpPostId,
      trashed: !force,
    };
  }
}
