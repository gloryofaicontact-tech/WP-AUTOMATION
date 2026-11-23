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

    // 2. Discover all Taxonomies
    const allTaxonomies = await this.taxonomyDiscovery.discover(credentials.url, authHeader);

    const discoveredSlugs = new Set<string>();
    const savedContentTypes: ContentType[] = [];

    // 3. Process each discovered Post Type
    for (const postType of discoveredTypes) {
      discoveredSlugs.add(postType.slug);

      // Map taxonomies linked to this post type
      const associatedTaxonomies = allTaxonomies
        .filter((tax) => tax.types.includes(postType.slug))
        .map((tax) => ({
          slug: tax.slug,
          name: tax.name,
          restBase: tax.restBase,
          restNamespace: tax.restNamespace,
          hierarchical: tax.hierarchical,
        }));

      // Inspect schema via OPTIONS request
      const schemaResult = await this.schemaDiscovery.inspect(
        credentials.url,
        postType.restNamespace,
        postType.restBase,
        authHeader,
      );

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
          schema: schemaResult.schema,
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
          schema: schemaResult.schema,
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
    const contentType = await this.prisma.contentType.findUnique({
      where: {
        websiteId_slug: {
          websiteId,
          slug,
        },
      },
    });

    if (!contentType) {
      throw new NotFoundException(`Content type '${slug}' not found for this website.`);
    }

    return contentType;
  }
}
