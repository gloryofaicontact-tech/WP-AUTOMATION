import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { WebsitesService } from '../../websites/websites.service';
import { PostTypeDiscoveryService } from '../discovery/post-type-discovery.service';
import { TaxonomyDiscoveryService } from '../discovery/taxonomy-discovery.service';
import { SchemaDiscoveryService } from '../discovery/schema-discovery.service';
import { logAudit } from '../../../common/utils/audit.util';
import { ContentType } from '@prisma/client';

@Injectable()
export class ContentTypeService {
  private readonly logger = new Logger(ContentTypeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websitesService: WebsitesService,
    private readonly postTypeDiscovery: PostTypeDiscoveryService,
    private readonly taxonomyDiscovery: TaxonomyDiscoveryService,
    private readonly schemaDiscovery: SchemaDiscoveryService,
  ) {}

  /**
   * Automatically discovers and registers all available WordPress post types for a website.
   * If a previously registered post type is no longer returned, it is marked as isActive=false
   * to preserve all previous snapshots and enhancement history.
   */
  async discoverAndSync(websiteId: string, userId?: string): Promise<ContentType[]> {
    const credentials = await this.websitesService.getDecryptedCredentials(websiteId);
    const cleanPassword = credentials.applicationPassword.replace(/\s+/g, '');
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${cleanPassword}`).toString('base64')}`;

    this.logger.log(`Starting dynamic content discovery for website: ${credentials.url}`);

    // 1. Discover all eligible Post Types
    const discoveredTypes = await this.postTypeDiscovery.discover(credentials.url, authHeader);

    // 2. Discover all Taxonomies & their real terms
    const allTaxonomies = await this.taxonomyDiscovery.discover(credentials.url, authHeader);
    const taxonomyTermsMap = new Map<string, Array<{ id: number; name: string; slug: string }>>();
    await Promise.all(
      allTaxonomies.map(async (tax) => {
        const terms = await this.taxonomyDiscovery.fetchTerms(
          credentials.url,
          authHeader,
          tax.restNamespace,
          tax.restBase,
        );
        taxonomyTermsMap.set(tax.slug, terms);
      }),
    );

    const discoveredSlugs = new Set<string>();
    const savedContentTypes: ContentType[] = [];

    // 3. Process each discovered Post Type
    for (const postType of discoveredTypes) {
      discoveredSlugs.add(postType.slug);

      // Map taxonomies linked to this post type (including real terms)
      const associatedTaxonomies = allTaxonomies
        .filter((tax) => tax.types.includes(postType.slug))
        .map((tax) => ({
          slug: tax.slug,
          name: tax.name,
          restBase: tax.restBase,
          restNamespace: tax.restNamespace,
          hierarchical: tax.hierarchical,
          terms: taxonomyTermsMap.get(tax.slug) || [],
        }));

      // Inspect schema via OPTIONS request
      const schemaResult = await this.schemaDiscovery.inspect(
        credentials.url,
        postType.restNamespace,
        postType.restBase,
        authHeader,
      );

      // Inspect 1 live sample post (zero AI cost) to detect real HTML layout & image slots
      const layoutBlueprint = await this.inspectSampleLayout(
        credentials.url,
        postType.restNamespace,
        postType.restBase,
        authHeader,
        postType.supports,
      );

      const enrichedSchema = {
        ...(typeof schemaResult.schema === 'object' && schemaResult.schema !== null
          ? (schemaResult.schema as Record<string, any>)
          : {}),
        _layoutBlueprint: layoutBlueprint,
      };

      // Upsert into content_types table
      const record = await this.prisma.contentType.upsert({
        where: {
          websiteId_slug: {
            websiteId,
            slug: postType.slug,
          },
        },
        update: {
          name: postType.name,
          description: postType.description,
          restNamespace: postType.restNamespace,
          restBase: postType.restBase,
          hierarchical: postType.hierarchical,
          supports: postType.supports,
          taxonomies: associatedTaxonomies,
          schema: enrichedSchema,
          schemaStatus: schemaResult.schemaStatus,
          isActive: true,
          lastDiscoveredAt: new Date(),
        },
        create: {
          websiteId,
          slug: postType.slug,
          name: postType.name,
          description: postType.description,
          restNamespace: postType.restNamespace,
          restBase: postType.restBase,
          hierarchical: postType.hierarchical,
          supports: postType.supports,
          taxonomies: associatedTaxonomies,
          schema: enrichedSchema,
          schemaStatus: schemaResult.schemaStatus,
          isActive: true,
        },
      });

      savedContentTypes.push(record);
    }

    // 4. Remove unreferenced junk types with 0 snapshots, and deactivate any that have historical snapshots
    await this.prisma.contentType.deleteMany({
      where: {
        websiteId,
        slug: { notIn: Array.from(discoveredSlugs) },
        snapshots: { none: {} },
      },
    });

    await this.prisma.contentType.updateMany({
      where: {
        websiteId,
        slug: { notIn: Array.from(discoveredSlugs) },
      },
      data: {
        isActive: false,
      },
    });

    // 5. Update website lastSyncAt
    await this.prisma.website.update({
      where: { id: websiteId },
      data: { lastSyncAt: new Date() },
    });

    if (userId) {
      await logAudit(this.prisma, {
        userId,
        action: 'CONTENT_TYPES_DISCOVERED',
        entity: 'Website',
        entityId: websiteId,
        details: {
          discoveredCount: savedContentTypes.length,
          types: savedContentTypes.map((t) => t.slug),
        },
      });
    }

    this.logger.log(`Dynamic content discovery completed. Saved ${savedContentTypes.length} content types.`);
    return savedContentTypes;
  }

  /**
   * Retrieves all active content types for a website.
   */
  async findByWebsite(websiteId: string): Promise<ContentType[]> {
    return this.prisma.contentType.findMany({
      where: {
        websiteId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Retrieves single content type by slug.
   */
  async findByWebsiteAndSlug(websiteId: string, slug: string): Promise<ContentType> {
    // 1. Try exact match
    let contentType = await this.prisma.contentType.findUnique({
      where: {
        websiteId_slug: {
          websiteId,
          slug,
        },
      },
    });

    // 2. If not found, try flexible fallback (hyphens <-> underscores)
    if (!contentType) {
      const alternateSlug = slug.includes('-')
        ? slug.replace(/-/g, '_')
        : slug.replace(/_/g, '-');

      contentType = await this.prisma.contentType.findUnique({
        where: {
          websiteId_slug: {
            websiteId,
            slug: alternateSlug,
          },
        },
      });
    }

    if (!contentType) {
      throw new NotFoundException(`Content type '${slug}' not found for this website.`);
    }

    return contentType;
  }

  /**
   * Fetches up to 3 latest published posts for a post type (zero AI cost) and picks
   * the richest sample to extract real image slots, clean HTML structure, ACF & meta keys.
   */
  private async inspectSampleLayout(
    siteUrl: string,
    restNamespace: string,
    restBase: string,
    authHeader: string,
    supports: Record<string, any> | null | undefined,
  ) {
    const supportsThumbnail = Boolean(supports && supports.thumbnail);
    const fallbackBlueprint = {
      hasSamplePost: false,
      hasFeaturedImage: supportsThumbnail,
      featuredImageRenderedInTemplate: supportsThumbnail,
      inlineImageCount: 0,
      acfImageFields: [] as string[],
      sampleHeadings: [] as string[],
      sampleHtmlSnippet: '',
      sampleAcfExample: null as Record<string, any> | null,
      sampleMetaKeys: [] as string[],
    };

    try {
      const url = `${siteUrl}/wp-json/${restNamespace}/${restBase}?per_page=3&status=publish&_embed=true`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return fallbackBlueprint;
      }

      const items: any[] = await res.json();
      if (!Array.isArray(items) || items.length === 0) {
        return fallbackBlueprint;
      }

      // Pick the richest sample post (most content length)
      const sample = items.reduce((best, curr) => {
        const bestLen = (best?.content?.rendered || '').length;
        const currLen = (curr?.content?.rendered || '').length;
        return currLen > bestLen ? curr : best;
      }, items[0]);

      const rawHtml: string = sample.content?.rendered || sample.content?.raw || '';
      const imgMatches = rawHtml.match(/<img\b[^>]*>/gi) || [];
      const headingMatches = [...rawHtml.matchAll(/<h[23][^>]*>(.*?)<\/h[23]>/gi)]
        .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
        .filter(Boolean)
        .slice(0, 12);

      // Strip only <script>/<style> tags and noisy responsive image attributes; keep class, style, and WP blocks intact
      const cleanSkeleton = rawHtml
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/\s+(?:data-[a-z0-9-]+|srcset|sizes|decoding|loading|width|height)="[^"]*"/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 16000);

      const hasFeaturedImage = supportsThumbnail || Boolean(sample.featured_media);
      const sampleAcfExample =
        sample.acf && typeof sample.acf === 'object' && Object.keys(sample.acf).length > 0
          ? sample.acf
          : null;

      // Detect ACF image/gallery fields from sample values or field naming
      const acfImageFields: string[] = [];
      if (sampleAcfExample) {
        for (const [key, val] of Object.entries(sampleAcfExample)) {
          const isImageObj =
            val && typeof val === 'object' && !Array.isArray(val) && ('url' in val || 'ID' in val || 'sizes' in val);
          const isImageArr =
            Array.isArray(val) &&
            val.some((v) => v && typeof v === 'object' && ('url' in v || 'ID' in v));
          const looksLikeImageName = /(image|photo|gallery|banner|cover|thumb)/i.test(key);
          if (isImageObj || isImageArr || (looksLikeImageName && (typeof val === 'number' || typeof val === 'string' || val === false))) {
            acfImageFields.push(key);
          }
        }
      }

      // Check whether the live rendered webpage actually displays the featured image visually
      let featuredImageRenderedInTemplate = hasFeaturedImage;
      const featuredSourceUrl: string | undefined =
        sample._embedded?.['wp:featuredmedia']?.[0]?.source_url;
      if (hasFeaturedImage && featuredSourceUrl && sample.link) {
        try {
          const livePageRes = await fetch(sample.link, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WP-Automation-Scanner/1.0)' },
            signal: AbortSignal.timeout(6000),
          });
          if (livePageRes.ok) {
            const liveHtml = await livePageRes.text();
            const baseFilename = featuredSourceUrl
              .split('/')
              .pop()
              ?.replace(/\.[a-z0-9]+$/i, '')
              ?.replace(/-\d+x\d+$/, '');
            if (baseFilename && baseFilename.length >= 3) {
              featuredImageRenderedInTemplate = liveHtml.includes(baseFilename);
            }
          }
        } catch {
          // Keep default true if live page probe fails
        }
      }

      const sampleMetaKeys =
        sample.meta && typeof sample.meta === 'object'
          ? Object.keys(sample.meta).filter((k) => !k.startsWith('_'))
          : [];

      return {
        hasSamplePost: true,
        hasFeaturedImage,
        featuredImageRenderedInTemplate,
        inlineImageCount: imgMatches.length,
        acfImageFields,
        sampleHeadings: headingMatches,
        sampleHtmlSnippet: cleanSkeleton,
        sampleAcfExample,
        sampleMetaKeys,
      };
    } catch (err: any) {
      this.logger.debug(`Sample layout inspection skipped for ${restBase}: ${err.message}`);
      return fallbackBlueprint;
    }
  }
}
