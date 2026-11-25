import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { WebsitesService } from '../websites/websites.service';
import { ContentTypeService } from '../Articles/registry/content-type.service';
import { AiEngineService } from '../ai-engine/ai-engine.service';
import { MediaDiscoveryService } from '../media-discovery/media-discovery.service';
import { WpPublisherService } from './services/wp-publisher.service';
import { ProcessArticleRequestDto } from './dto/process-article.dto';
import { UpdateArticleDraftDto } from './dto/update-article-draft.dto';
import { WorkflowStatus } from '@prisma/client';

@Injectable()
export class ArticlesManagerService {
  private readonly logger = new Logger(ArticlesManagerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websitesService: WebsitesService,
    private readonly contentTypeService: ContentTypeService,
    private readonly aiEngineService: AiEngineService,
    private readonly mediaDiscoveryService: MediaDiscoveryService,
    private readonly wpPublisherService: WpPublisherService,
  ) {}

  /**
   * Processes a raw text document with the AI Engine and Media Discovery,
   * saving the resulting structured draft into PostgreSQL.
   */
  async processAndCreateDraft(websiteId: string, dto: ProcessArticleRequestDto, userId?: string) {
    const contentType = await this.contentTypeService.findByWebsiteAndSlug(websiteId, dto.contentTypeSlug);
    const website = await this.websitesService.findById(websiteId);

    // Extract available taxonomies and ACF fields from the scanned ContentType
    const availableCategories: Array<{ name: string; slug: string }> = [];
    const availableTags: Array<{ name: string; slug: string }> = [];

    if (Array.isArray(contentType.taxonomies)) {
      for (const tax of contentType.taxonomies as any[]) {
        if (tax.slug === 'category') {
          availableCategories.push({ name: tax.name, slug: tax.slug });
        } else if (tax.slug === 'post_tag') {
          availableTags.push({ name: tax.name, slug: tax.slug });
        }
      }
    }

    const acfFields = (contentType.schema as any)?.properties?.acf?.fields || [];
    const supportedFeatures = Object.keys(contentType.supports || {});

    // Step 1: Run AI Document Parser
    this.logger.log(`Parsing raw document for website "${website.name}" (Type: "${contentType.name}")...`);
    const aiParsed = await this.aiEngineService.parseArticle(
      dto.rawDocument,
      {
        websiteName: website.name,
        websiteUrl: website.url,
        contentTypeSlug: contentType.slug,
        contentTypeName: contentType.name,
        availableCategories,
        availableTags,
        supportedFeatures,
        acfFields,
      },
      dto.preferredAiProvider,
    );

    // Step 2: Run Media & Envato Discovery for recommended placeholders
    this.logger.log(`Discovering media assets for ${aiParsed.imagePlaceholders.length} layout placeholders...`);
    const matchedImages = await this.mediaDiscoveryService.discoverImagesForPlaceholders(
      aiParsed.imagePlaceholders,
    );

    const featuredImage = matchedImages.find((img) => img.position === 'featured_hero') || matchedImages[0];
    const featuredMediaUrl = featuredImage?.selectedAsset?.downloadUrl || null;

    // Step 3: Save structured draft into database
    const snapshot = await this.prisma.contentSnapshot.create({
      data: {
        websiteId,
        contentTypeId: contentType.id,
        title: aiParsed.title,
        slug: aiParsed.slug,
        rawContent: aiParsed.contentHtml,
        rawExcerpt: aiParsed.metaDescription,
        rawDocument: dto.rawDocument,
        focusKeyword: aiParsed.focusKeyword,
        metaDescription: aiParsed.metaDescription,
        wpStatus: 'draft',
        workflowStatus: WorkflowStatus.IMPORTED,
        featuredMediaUrl,
        originalData: {
          aiParsed,
          matchedImages,
        } as any,
        taxonomiesData: {
          categorySlugs: aiParsed.categorySlugs,
          tagSlugs: aiParsed.tagSlugs,
        },
        customFields: aiParsed.customFields,
      },
    });

    this.logger.log(`Draft article saved successfully (ID: ${snapshot.id}, Title: "${snapshot.title}")`);

    return {
      id: snapshot.id,
      websiteId: snapshot.websiteId,
      contentTypeSlug: contentType.slug,
      contentTypeName: contentType.name,
      title: snapshot.title,
      slug: snapshot.slug,
      focusKeyword: snapshot.focusKeyword,
      metaDescription: snapshot.metaDescription,
      contentHtml: snapshot.rawContent,
      workflowStatus: snapshot.workflowStatus,
      wpStatus: snapshot.wpStatus,
      featuredMediaUrl: snapshot.featuredMediaUrl,
      images: matchedImages,
      categories: aiParsed.categorySlugs,
      tags: aiParsed.tagSlugs,
      customFields: snapshot.customFields,
      summaryNotes: aiParsed.summaryNotes,
      createdAt: snapshot.createdAt,
    };
  }

  /**
   * Lists all articles (drafts and published) for a given website.
   */
  async listArticles(websiteId: string, page = 1, limit = 20, status?: string) {
    const skip = (Math.max(1, page) - 1) * limit;
    const where: any = { websiteId };

    if (status) {
      where.workflowStatus = status.toUpperCase();
    }

    const [total, items] = await Promise.all([
      this.prisma.contentSnapshot.count({ where }),
      this.prisma.contentSnapshot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contentType: {
            select: { name: true, slug: true },
          },
        },
      }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        wpPostId: item.wpPostId,
        title: item.title,
        slug: item.slug,
        contentType: item.contentType.name,
        contentTypeSlug: item.contentType.slug,
        workflowStatus: item.workflowStatus,
        wpStatus: item.wpStatus,
        wpUrl: item.wpUrl,
        focusKeyword: item.focusKeyword,
        featuredMediaUrl: item.featuredMediaUrl,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves single article preview with its matched images.
   */
  async getArticleById(id: string) {
    const item = await this.prisma.contentSnapshot.findUnique({
      where: { id },
      include: {
        contentType: true,
        website: { select: { id: true, name: true, url: true } },
      },
    });

    if (!item) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    const originalData: any = item.originalData || {};
    const matchedImages = originalData.matchedImages || [];

    return {
      id: item.id,
      website: item.website,
      contentType: {
        id: item.contentType.id,
        name: item.contentType.name,
        slug: item.contentType.slug,
      },
      wpPostId: item.wpPostId,
      title: item.title,
      slug: item.slug,
      focusKeyword: item.focusKeyword,
      metaDescription: item.metaDescription,
      contentHtml: item.rawContent,
      workflowStatus: item.workflowStatus,
      wpStatus: item.wpStatus,
      wpUrl: item.wpUrl,
      featuredMediaUrl: item.featuredMediaUrl,
      images: matchedImages,
      taxonomies: item.taxonomiesData,
      customFields: item.customFields,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  /**
   * Updates an existing article draft before publishing.
   */
  async updateArticleDraft(id: string, dto: UpdateArticleDraftDto) {
    const existing = await this.prisma.contentSnapshot.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.focusKeyword !== undefined) data.focusKeyword = dto.focusKeyword;
    if (dto.metaDescription !== undefined) {
      data.metaDescription = dto.metaDescription;
      data.rawExcerpt = dto.metaDescription;
    }
    if (dto.contentHtml !== undefined) data.rawContent = dto.contentHtml;
    if (dto.featuredImageUrl !== undefined) data.featuredMediaUrl = dto.featuredImageUrl;
    if (dto.customFields !== undefined) data.customFields = dto.customFields;
    if (dto.categorySlugs !== undefined || dto.tagSlugs !== undefined) {
      const currentTax: any = existing.taxonomiesData || {};
      data.taxonomiesData = {
        categorySlugs: dto.categorySlugs ?? currentTax.categorySlugs,
        tagSlugs: dto.tagSlugs ?? currentTax.tagSlugs,
      };
    }

    const updated = await this.prisma.contentSnapshot.update({
      where: { id },
      data,
    });

    return {
      id: updated.id,
      title: updated.title,
      slug: updated.slug,
      focusKeyword: updated.focusKeyword,
      metaDescription: updated.metaDescription,
      featuredMediaUrl: updated.featuredMediaUrl,
      customFields: updated.customFields,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Builds WordPress Basic Auth header and returns site URL + header.
   */
  private async getWpAuth(websiteId: string) {
    const credentials = await this.websitesService.getDecryptedCredentials(websiteId);
    const cleanPassword = credentials.applicationPassword.replace(/\s+/g, '');
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${cleanPassword}`).toString('base64')}`;
    return { siteUrl: credentials.url, authHeader };
  }

  /**
   * Replaces an image URL inside draft HTML and featuredMediaUrl when swapping/uploading media.
   */
  private replaceImageReferences(
    rawContent: string | null,
    featuredMediaUrl: string | null,
    isFeaturedSlot: boolean,
    oldUrl: string | undefined,
    newUrl: string,
  ) {
    let updatedContent = rawContent || '';
    if (oldUrl && updatedContent.includes(oldUrl)) {
      updatedContent = updatedContent.split(oldUrl).join(newUrl);
    }
    const updatedFeatured =
      isFeaturedSlot || (oldUrl && featuredMediaUrl === oldUrl)
        ? newUrl
        : featuredMediaUrl;
    return { updatedContent, updatedFeatured };
  }

  /**
   * Publishes an approved article directly to WordPress via the REST API.
   */
  async publishToWordPress(
    id: string,
    publishStatus: 'publish' | 'draft' | 'pending' = 'publish',
    allowPreviewImages = false,
  ) {
    const article = await this.prisma.contentSnapshot.findUnique({
      where: { id },
      include: {
        contentType: true,
        website: true,
      },
    });

    if (!article) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    const originalData: any = article.originalData || {};
    const matchedImages: any[] = Array.isArray(originalData.matchedImages)
      ? originalData.matchedImages
      : [];

    // Preview Image Publish Guard: block accidental live publishing with Envato preview URLs
    if (publishStatus === 'publish' && !allowPreviewImages) {
      const previewPlaceholders = matchedImages.filter((img) => img?.isPreviewOnly === true);
      const hasPreviewUrl =
        (article.featuredMediaUrl && article.featuredMediaUrl.includes('envatousercontent.com')) ||
        (article.rawContent && article.rawContent.includes('envatousercontent.com'));

      if (previewPlaceholders.length > 0 || hasPreviewUrl) {
        const pendingList = previewPlaceholders.map((p) => ({
          placeholderId: p.placeholderId,
          position: p.position,
          recommendedSearch: p.recommendedSearch,
          elementsSearchUrl: p.elementsSearchUrl,
        }));
        throw new BadRequestException({
          message:
            'Article still contains unreplaced Envato preview images. Upload licensed images via POST /media or pass allowPreviewImages: true to publish anyway.',
          previewPlaceholders: pendingList,
        });
      }
    }

    const { siteUrl, authHeader } = await this.getWpAuth(article.websiteId);

    // Step 1: Upload Featured Media to WordPress Media Library if not already uploaded
    let featuredMediaId: number | undefined = article.featuredMediaId || undefined;
    if (!featuredMediaId && article.featuredMediaUrl) {
      this.logger.log(`Uploading featured image to WordPress Media Library...`);
      const mediaResult = await this.wpPublisherService.uploadMediaFromUrl(
        siteUrl,
        authHeader,
        article.featuredMediaUrl,
        article.title,
        article.metaDescription || article.title,
      );

      if (mediaResult) {
        featuredMediaId = mediaResult.id;
        this.logger.log(`Featured media uploaded successfully with ID: ${featuredMediaId}`);
      }
    }

    // Step 2: Publish or Update Post to WordPress REST API
    const existingWpPostId = article.wpPostId || undefined;
    const result = await this.wpPublisherService.publishPost(
      siteUrl,
      authHeader,
      article.contentType.restNamespace,
      article.contentType.restBase,
      {
        title: article.title,
        content: article.rawContent || '',
        excerpt: article.metaDescription || '',
        status: publishStatus,
        featured_media: featuredMediaId || undefined,
        acf: (article.customFields as any) || undefined,
      },
      existingWpPostId,
    );

    // Step 3: Update local snapshot with live WordPress details
    const workflowStatus =
      publishStatus === 'publish' ? WorkflowStatus.PUBLISHED : WorkflowStatus.IMPORTED;

    const updated = await this.prisma.contentSnapshot.update({
      where: { id },
      data: {
        wpPostId: result.wpPostId,
        wpUrl: result.wpUrl,
        wpStatus: result.wpStatus,
        workflowStatus,
        wpPublishedAt: publishStatus === 'publish' ? new Date() : article.wpPublishedAt,
        featuredMediaId: featuredMediaId || null,
      },
    });

    this.logger.log(
      `Article ${existingWpPostId ? 'updated' : 'published'} on WordPress! ID: ${result.wpPostId}, Status: ${result.wpStatus}, Live URL: ${result.wpUrl}`,
    );

    return {
      id: updated.id,
      wpPostId: updated.wpPostId,
      wpUrl: updated.wpUrl,
      wpStatus: updated.wpStatus,
      workflowStatus: updated.workflowStatus,
      title: updated.title,
      publishedAt: updated.wpPublishedAt,
    };
  }

  /**
   * Uploads a user-provided licensed image file directly to WordPress Media Library
   * and replaces the placeholder preview URL in the draft.
   */
  async uploadArticleMedia(
    id: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
    placeholderId?: string,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Image file is required.');
    }

    const article = await this.prisma.contentSnapshot.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    const originalData: any = article.originalData || {};
    const matchedImages: any[] = Array.isArray(originalData.matchedImages)
      ? [...originalData.matchedImages]
      : [];

    const targetIndex = placeholderId
      ? matchedImages.findIndex((img) => img.placeholderId === placeholderId)
      : 0;

    if (placeholderId && targetIndex === -1 && matchedImages.length > 0) {
      throw new NotFoundException(`Placeholder "${placeholderId}" not found on this article.`);
    }

    const targetPlaceholder = targetIndex >= 0 ? matchedImages[targetIndex] : null;
    const isFeaturedSlot =
      !targetPlaceholder || targetPlaceholder.position === 'featured_hero';

    const { siteUrl, authHeader } = await this.getWpAuth(article.websiteId);
    const uploaded = await this.wpPublisherService.uploadMediaBuffer(
      siteUrl,
      authHeader,
      file.buffer,
      file.mimetype || 'image/jpeg',
      article.title,
      targetPlaceholder?.altText || article.title,
      file.originalname,
    );

    if (!uploaded || !uploaded.sourceUrl) {
      throw new BadRequestException('Failed to upload image to WordPress Media Library.');
    }

    const oldUrl = targetPlaceholder?.selectedAsset?.downloadUrl || targetPlaceholder?.selectedAsset?.previewUrl;
    const { updatedContent, updatedFeatured } = this.replaceImageReferences(
      article.rawContent,
      article.featuredMediaUrl,
      isFeaturedSlot,
      oldUrl,
      uploaded.sourceUrl,
    );

    if (targetPlaceholder) {
      matchedImages[targetIndex] = {
        ...targetPlaceholder,
        isPreviewOnly: false,
        selectedAsset: {
          id: `wp-${uploaded.id}`,
          title: file.originalname || article.title,
          previewUrl: uploaded.sourceUrl,
          sourceUrl: uploaded.sourceUrl,
          downloadUrl: uploaded.sourceUrl,
          author: 'Uploaded (Licensed)',
          isLicensed: true,
          provider: 'wordpress',
        },
      };
    }

    await this.prisma.contentSnapshot.update({
      where: { id },
      data: {
        rawContent: updatedContent,
        featuredMediaUrl: updatedFeatured,
        featuredMediaId: isFeaturedSlot ? uploaded.id : article.featuredMediaId,
        originalData: {
          ...originalData,
          matchedImages,
        } as any,
      },
    });

    return {
      id: article.id,
      placeholderId: targetPlaceholder?.placeholderId || 'featured_hero',
      wpMediaId: uploaded.id,
      mediaUrl: uploaded.sourceUrl,
      isPreviewOnly: false,
      images: matchedImages,
    };
  }

  /**
   * Swaps the selected image for a placeholder from its returned alternative options.
   */
  async selectArticleMedia(id: string, placeholderId: string, assetId: string) {
    const article = await this.prisma.contentSnapshot.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    const originalData: any = article.originalData || {};
    const matchedImages: any[] = Array.isArray(originalData.matchedImages)
      ? [...originalData.matchedImages]
      : [];

    const targetIndex = matchedImages.findIndex((img) => img.placeholderId === placeholderId);
    if (targetIndex === -1) {
      throw new NotFoundException(`Placeholder "${placeholderId}" not found on this article.`);
    }

    const target = matchedImages[targetIndex];
    const allOptions = [target.selectedAsset, ...(target.alternativeOptions || [])].filter(Boolean);
    const chosen = allOptions.find((opt: any) => String(opt.id) === String(assetId));
    if (!chosen) {
      throw new NotFoundException(`Asset "${assetId}" not found for placeholder "${placeholderId}".`);
    }

    const oldUrl = target.selectedAsset?.downloadUrl || target.selectedAsset?.previewUrl;
    const newUrl = chosen.downloadUrl || chosen.previewUrl;
    const isFeaturedSlot = target.position === 'featured_hero';

    const { updatedContent, updatedFeatured } = this.replaceImageReferences(
      article.rawContent,
      article.featuredMediaUrl,
      isFeaturedSlot,
      oldUrl,
      newUrl,
    );

    const remainingAlternatives = allOptions.filter((opt: any) => String(opt.id) !== String(assetId));
    matchedImages[targetIndex] = {
      ...target,
      isPreviewOnly: !chosen.isLicensed && chosen.provider === 'envato',
      selectedAsset: chosen,
      alternativeOptions: remainingAlternatives,
    };

    await this.prisma.contentSnapshot.update({
      where: { id },
      data: {
        rawContent: updatedContent,
        featuredMediaUrl: updatedFeatured,
        featuredMediaId: isFeaturedSlot ? null : article.featuredMediaId,
        originalData: {
          ...originalData,
          matchedImages,
        } as any,
      },
    });

    return {
      id: article.id,
      placeholderId,
      selectedAsset: chosen,
      featuredMediaUrl: updatedFeatured,
      images: matchedImages,
    };
  }

  /**
   * Re-searches Envato for a specific placeholder using a custom keyword query.
   */
  async searchArticleMedia(id: string, placeholderId: string, query: string) {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException('A search query of at least 2 characters is required.');
    }

    const article = await this.prisma.contentSnapshot.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    const originalData: any = article.originalData || {};
    const matchedImages: any[] = Array.isArray(originalData.matchedImages)
      ? [...originalData.matchedImages]
      : [];

    const targetIndex = matchedImages.findIndex((img) => img.placeholderId === placeholderId);
    if (targetIndex === -1) {
      throw new NotFoundException(`Placeholder "${placeholderId}" not found on this article.`);
    }

    const assets = await this.mediaDiscoveryService.searchCustomAssets(query.trim(), 4);
    if (!assets || assets.length === 0) {
      return {
        id: article.id,
        placeholderId,
        query: query.trim(),
        found: 0,
        images: matchedImages,
      };
    }

    const target = matchedImages[targetIndex];
    const oldUrl = target.selectedAsset?.downloadUrl || target.selectedAsset?.previewUrl;
    const selectedAsset = assets[0];
    const newUrl = selectedAsset.downloadUrl || selectedAsset.previewUrl;
    const isFeaturedSlot = target.position === 'featured_hero';

    const { updatedContent, updatedFeatured } = this.replaceImageReferences(
      article.rawContent,
      article.featuredMediaUrl,
      isFeaturedSlot,
      oldUrl,
      newUrl,
    );

    matchedImages[targetIndex] = {
      ...target,
      recommendedSearch: query.trim(),
      elementsSearchUrl:
        selectedAsset.elementsSearchUrl ||
        `https://elements.envato.com/photos/${encodeURIComponent(query.trim())}`,
      isPreviewOnly: !selectedAsset.isLicensed && selectedAsset.provider === 'envato',
      selectedAsset,
      alternativeOptions: assets.slice(1),
    };

    await this.prisma.contentSnapshot.update({
      where: { id },
      data: {
        rawContent: updatedContent,
        featuredMediaUrl: updatedFeatured,
        featuredMediaId: isFeaturedSlot ? null : article.featuredMediaId,
        originalData: {
          ...originalData,
          matchedImages,
        } as any,
      },
    });

    return {
      id: article.id,
      placeholderId,
      query: query.trim(),
      found: assets.length,
      featuredMediaUrl: updatedFeatured,
      images: matchedImages,
    };
  }

  /**
   * Deletes an article from the platform and optionally trashes/deletes it on WordPress.
   */
  async deleteArticle(id: string, force = false) {
    const article = await this.prisma.contentSnapshot.findUnique({
      where: { id },
      include: {
        contentType: true,
        website: true,
      },
    });

    if (!article) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    let wpDeleted = false;
    // If post was pushed to WordPress, trash or permanently delete it on WordPress
    if (article.wpPostId) {
      try {
        const credentials = await this.websitesService.getDecryptedCredentials(article.websiteId);
        const cleanPassword = credentials.applicationPassword.replace(/\s+/g, '');
        const authHeader = `Basic ${Buffer.from(`${credentials.username}:${cleanPassword}`).toString('base64')}`;

        await this.wpPublisherService.deletePost(
          credentials.url,
          authHeader,
          article.contentType.restNamespace,
          article.contentType.restBase,
          article.wpPostId,
          force,
        );
        wpDeleted = true;
      } catch (err: any) {
        this.logger.warn(
          `Failed to delete WordPress post #${article.wpPostId}: ${err.message}. Proceeding with local removal.`,
        );
      }
    }

    // Delete local draft from PostgreSQL
    await this.prisma.contentSnapshot.delete({
      where: { id },
    });

    return {
      success: true,
      id,
      wpPostId: article.wpPostId,
      wpDeleted,
      message: article.wpPostId
        ? `Article deleted from local platform and ${force ? 'permanently deleted' : 'moved to trash'} on WordPress.`
        : 'Draft article deleted successfully.',
    };
  }
}
