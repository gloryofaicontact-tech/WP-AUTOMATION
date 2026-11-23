import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { WebsitesService } from '../../websites/websites.service';
import { ContentTypeService } from '../registry/content-type.service';

export interface ContentQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  author?: number;
  order?: 'asc' | 'desc';
  orderby?: string;
}

function cleanHtmlText(text?: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class ContentRetrievalService {
  private readonly logger = new Logger(ContentRetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websitesService: WebsitesService,
    private readonly contentTypeService: ContentTypeService,
  ) {}

  /**
   * Queries live content records directly from WordPress with pagination and filtering.
   * Does NOT store items in the database.
   */
  async listLiveContent(
    websiteId: string,
    contentTypeSlug: string,
    query: ContentQueryOptions = {},
  ) {
    const contentType = await this.contentTypeService.findByWebsiteAndSlug(websiteId, contentTypeSlug);
    const credentials = await this.websitesService.getDecryptedCredentials(websiteId);

    const cleanPassword = credentials.applicationPassword.replace(/\s+/g, '');
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${cleanPassword}`).toString('base64')}`;

    const page = Math.max(1, Number(query.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(query.limit) || 10));

    // Build URL using discovered restNamespace and restBase
    const baseUrl = `${credentials.url}/wp-json/${contentType.restNamespace}/${contentType.restBase}`;
    const buildUrl = (includeEditContext: boolean, statusVal?: string) => {
      const u = new URL(baseUrl);
      u.searchParams.set('page', String(page));
      u.searchParams.set('per_page', String(perPage));
      u.searchParams.set('_embed', 'true');

      if (includeEditContext) {
        u.searchParams.set('context', 'edit');
      }

      if (query.search?.trim()) {
        u.searchParams.set('search', query.search.trim());
      }

      if (statusVal) {
        u.searchParams.set('status', statusVal);
      }

      if (query.order) {
        u.searchParams.set('order', query.order);
      }

      if (query.orderby) {
        u.searchParams.set('orderby', query.orderby);
      }

      return u.toString();
    };

    // If query.status is explicitly passed, use it. Otherwise attempt 'any' with edit context.
    const initialStatus = query.status?.trim() || 'any';
    let targetUrl = buildUrl(true, initialStatus);

    this.logger.debug(`Fetching live WordPress content from: ${targetUrl}`);

    let response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    // If WordPress rejected status=any or context=edit due to auth/permission issues (400 or 401),
    // fallback gracefully to standard public fetch (published posts)
    if (!response.ok && (response.status === 400 || response.status === 401) && !query.status) {
      this.logger.warn(
        `WordPress rejected context=edit/status=any (HTTP ${response.status}). Falling back to public published posts.`,
      );
      targetUrl = buildUrl(false);
      response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.logger.error(`WordPress content fetch failed: HTTP ${response.status} - ${errorText}`);
      throw new BadRequestException(
        `Failed to retrieve content from WordPress: HTTP ${response.status} ${response.statusText}`,
      );
    }

    const totalItems = parseInt(response.headers.get('x-wp-total') || '0', 10);
    const totalPages = parseInt(response.headers.get('x-wp-totalpages') || '1', 10);
    const rawItems: any[] = await response.json();

    // Check which of these items already have a ContentSnapshot in our DB
    const postIds = rawItems.map((item) => item.id).filter(Boolean);
    const existingSnapshots = await this.prisma.contentSnapshot.findMany({
      where: {
        websiteId,
        wpPostId: { in: postIds },
      },
      select: {
        wpPostId: true,
        workflowStatus: true,
        updatedAt: true,
      },
    });

    const snapshotMap = new Map(existingSnapshots.map((s) => [s.wpPostId, s]));

    // Format clean preview items
    const items = rawItems.map((item) => {
      const featuredMedia = item._embedded?.['wp:featuredmedia']?.[0];
      const author = item._embedded?.author?.[0];
      const snapshot = snapshotMap.get(item.id);

      return {
        id: item.id,
        slug: item.slug,
        title: cleanHtmlText(item.title?.rendered || item.title?.raw || '(Untitled)'),
        status: item.status,
        date: item.date,
        modified: item.modified,
        link: item.link,
        excerpt: cleanHtmlText(item.excerpt?.rendered || item.excerpt?.raw || ''),
        featuredMedia: featuredMedia
          ? {
              id: featuredMedia.id,
              sourceUrl: featuredMedia.source_url,
              altText: featuredMedia.alt_text || '',
            }
          : null,
        author: author
          ? {
              id: author.id,
              name: author.name,
            }
          : null,
        hasSnapshot: Boolean(snapshot),
        workflowStatus: snapshot?.workflowStatus || null,
        snapshotUpdatedAt: snapshot?.updatedAt || null,
      };
    });

    return {
      data: items,
      meta: {
        contentType: {
          slug: contentType.slug,
          name: contentType.name,
          restNamespace: contentType.restNamespace,
          restBase: contentType.restBase,
        },
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          itemsPerPage: perPage,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    };
  }

  /**
   * Retrieves single full raw content record directly from WordPress.
   */
  async getLiveContentItem(
    websiteId: string,
    contentTypeSlug: string,
    wpPostId: number,
  ) {
    const contentType = await this.contentTypeService.findByWebsiteAndSlug(websiteId, contentTypeSlug);
    const credentials = await this.websitesService.getDecryptedCredentials(websiteId);

    const cleanPassword = credentials.applicationPassword.replace(/\s+/g, '');
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${cleanPassword}`).toString('base64')}`;

    let url = `${credentials.url}/wp-json/${contentType.restNamespace}/${contentType.restBase}/${wpPostId}?context=edit&_embed=true`;
    this.logger.debug(`Fetching single live WordPress content item from: ${url}`);

    let response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok && (response.status === 401 || response.status === 403)) {
      this.logger.warn(`WordPress rejected context=edit (HTTP ${response.status}). Retrying without edit context.`);
      url = `${credentials.url}/wp-json/${contentType.restNamespace}/${contentType.restBase}/${wpPostId}?_embed=true`;
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundException(`WordPress content item ${wpPostId} not found on ${credentials.url}`);
      }
      throw new BadRequestException(
        `Failed to retrieve item from WordPress: HTTP ${response.status} ${response.statusText}`,
      );
    }

    const rawData = await response.json();
    const featuredMedia = rawData._embedded?.['wp:featuredmedia']?.[0];
    const author = rawData._embedded?.author?.[0];

    const cleanItem = {
      id: rawData.id,
      slug: rawData.slug,
      title: cleanHtmlText(rawData.title?.rendered || rawData.title?.raw || '(Untitled)'),
      status: rawData.status,
      content: rawData.content?.raw || rawData.content?.rendered || '',
      excerpt: cleanHtmlText(rawData.excerpt?.rendered || rawData.excerpt?.raw || ''),
      date: rawData.date,
      modified: rawData.modified,
      link: rawData.link,
      featuredMedia: featuredMedia
        ? {
            id: featuredMedia.id,
            sourceUrl: featuredMedia.source_url,
            altText: featuredMedia.alt_text || '',
          }
        : null,
      author: author
        ? {
            id: author.id,
            name: author.name,
          }
        : null,
      acf: rawData.acf && Object.keys(rawData.acf).length > 0 ? rawData.acf : null,
    };

    return {
      contentType,
      rawData,
      cleanItem,
    };
  }
}
