import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ContentRetrievalService } from '../retrieval/content-retrieval.service';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { paginate } from '../../../common/utils/pagination.util';
import { logAudit } from '../../../common/utils/audit.util';
import { ContentSnapshot, WorkflowStatus, Prisma } from '@prisma/client';

export interface SnapshotFilterOptions {
  websiteId?: string;
  contentTypeId?: string;
  workflowStatus?: WorkflowStatus;
}

@Injectable()
export class ContentSnapshotService {
  private readonly logger = new Logger(ContentSnapshotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentRetrieval: ContentRetrievalService,
  ) {}

  /**
   * Captures a high-fidelity snapshot of a WordPress content item into PostgreSQL.
   * Stores the complete verbatim REST response in `originalData` JSON.
   */
  async createOrUpdateSnapshot(
    websiteId: string,
    contentTypeSlug: string,
    wpPostId: number,
    userId: string,
  ): Promise<ContentSnapshot> {
    // 1. Fetch full live item from WordPress
    const { contentType, rawData } = await this.contentRetrieval.getLiveContentItem(
      websiteId,
      contentTypeSlug,
      wpPostId,
    );

    // 2. Extract media
    const featuredMedia = rawData._embedded?.['wp:featuredmedia']?.[0];
    const featuredMediaId = rawData.featured_media || featuredMedia?.id || null;
    const featuredMediaUrl = featuredMedia?.source_url || null;

    // 3. Extract custom fields & ACF
    const customFields: Record<string, any> = {};
    if (rawData.acf && typeof rawData.acf === 'object') {
      customFields.acf = rawData.acf;
    }
    if (rawData.meta && typeof rawData.meta === 'object') {
      customFields.meta = rawData.meta;
    }

    // 4. Extract taxonomies
    const rawTerms = rawData._embedded?.['wp:term'] || [];
    const taxonomiesData: Record<string, any[]> = {};
    if (Array.isArray(rawTerms)) {
      for (const termGroup of rawTerms) {
        if (Array.isArray(termGroup)) {
          for (const term of termGroup) {
            const taxSlug = term.taxonomy || 'category';
            if (!taxonomiesData[taxSlug]) {
              taxonomiesData[taxSlug] = [];
            }
            taxonomiesData[taxSlug].push({
              id: term.id,
              name: term.name,
              slug: term.slug,
            });
          }
        }
      }
    }

    // 5. Upsert snapshot
    const snapshot = await this.prisma.contentSnapshot.upsert({
      where: {
        websiteId_wpPostId: {
          websiteId,
          wpPostId,
        },
      },
      update: {
        contentTypeId: contentType.id,
        slug: rawData.slug || String(wpPostId),
        title: rawData.title?.raw || rawData.title?.rendered || '(Untitled)',
        rawContent: rawData.content?.raw || rawData.content?.rendered || null,
        rawExcerpt: rawData.excerpt?.raw || rawData.excerpt?.rendered || null,
        wpStatus: rawData.status || 'publish',
        wpUrl: rawData.link || '',
        wpPublishedAt: rawData.date ? new Date(rawData.date) : null,
        wpModifiedAt: rawData.modified ? new Date(rawData.modified) : null,
        featuredMediaId,
        featuredMediaUrl,
        originalData: rawData, // Complete verbatim JSON
        customFields: Object.keys(customFields).length > 0 ? customFields : Prisma.DbNull,
        taxonomiesData: Object.keys(taxonomiesData).length > 0 ? taxonomiesData : Prisma.DbNull,
        updatedAt: new Date(),
      },
      create: {
        websiteId,
        contentTypeId: contentType.id,
        wpPostId,
        slug: rawData.slug || String(wpPostId),
        title: rawData.title?.raw || rawData.title?.rendered || '(Untitled)',
        rawContent: rawData.content?.raw || rawData.content?.rendered || null,
        rawExcerpt: rawData.excerpt?.raw || rawData.excerpt?.rendered || null,
        wpStatus: rawData.status || 'publish',
        wpUrl: rawData.link || '',
        wpPublishedAt: rawData.date ? new Date(rawData.date) : null,
        wpModifiedAt: rawData.modified ? new Date(rawData.modified) : null,
        featuredMediaId,
        featuredMediaUrl,
        originalData: rawData, // Complete verbatim JSON
        customFields: Object.keys(customFields).length > 0 ? customFields : Prisma.DbNull,
        taxonomiesData: Object.keys(taxonomiesData).length > 0 ? taxonomiesData : Prisma.DbNull,
        workflowStatus: WorkflowStatus.IMPORTED,
      },
      include: {
        contentType: true,
      },
    });

    await logAudit(this.prisma, {
      userId,
      action: 'CONTENT_SNAPSHOT_CAPTURED',
      entity: 'ContentSnapshot',
      entityId: snapshot.id,
      details: {
        websiteId,
        wpPostId,
        contentType: contentTypeSlug,
        title: snapshot.title,
      },
    });

    this.logger.log(`Captured ContentSnapshot for wpPostId=${wpPostId} ('${snapshot.title}')`);
    return snapshot;
  }

  /**
   * Lists all content snapshots currently in workflow with pagination.
   */
  async listSnapshots(
    paginationDto: PaginationDto,
    filters: SnapshotFilterOptions = {},
  ) {
    const where: any = {};
    if (filters.websiteId) where.websiteId = filters.websiteId;
    if (filters.contentTypeId) where.contentTypeId = filters.contentTypeId;
    if (filters.workflowStatus) where.workflowStatus = filters.workflowStatus;

    return paginate(this.prisma.contentSnapshot, paginationDto, {
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        websiteId: true,
        wpPostId: true,
        slug: true,
        title: true,
        wpStatus: true,
        wpUrl: true,
        wpPublishedAt: true,
        wpModifiedAt: true,
        featuredMediaUrl: true,
        workflowStatus: true,
        createdAt: true,
        updatedAt: true,
        contentType: {
          select: {
            slug: true,
            name: true,
            restNamespace: true,
            restBase: true,
          },
        },
      },
    });
  }

  /**
   * Retrieves single snapshot by ID (clean, readable view without raw binary/meta bloat).
   */
  async getSnapshotById(id: string) {
    const snapshot = await this.prisma.contentSnapshot.findUnique({
      where: { id },
      select: {
        id: true,
        websiteId: true,
        wpPostId: true,
        slug: true,
        title: true,
        rawContent: true,
        rawExcerpt: true,
        wpStatus: true,
        wpUrl: true,
        wpPublishedAt: true,
        wpModifiedAt: true,
        featuredMediaId: true,
        featuredMediaUrl: true,
        customFields: true,
        taxonomiesData: true,
        workflowStatus: true,
        createdAt: true,
        updatedAt: true,
        contentType: {
          select: {
            id: true,
            slug: true,
            name: true,
            restNamespace: true,
            restBase: true,
          },
        },
        website: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundException(`Content snapshot with ID ${id} not found.`);
    }

    return snapshot;
  }

  /**
   * Deletes a snapshot from workflow.
   */
  async deleteSnapshot(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    const snapshot = await this.prisma.contentSnapshot.findUnique({
      where: { id },
    });

    if (!snapshot) {
      throw new NotFoundException(`Content snapshot with ID ${id} not found.`);
    }

    await this.prisma.contentSnapshot.delete({
      where: { id },
    });

    await logAudit(this.prisma, {
      userId,
      action: 'CONTENT_SNAPSHOT_DELETED',
      entity: 'ContentSnapshot',
      entityId: id,
      details: {
        wpPostId: snapshot.wpPostId,
        title: snapshot.title,
      },
    });

    return { success: true, message: `Snapshot for '${snapshot.title}' removed from workflow.` };
  }
}
