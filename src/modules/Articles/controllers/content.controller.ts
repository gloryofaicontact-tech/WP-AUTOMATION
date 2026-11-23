import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ContentTypeService } from '../registry/content-type.service';
import { ContentRetrievalService } from '../retrieval/content-retrieval.service';
import { ContentSnapshotService } from '../snapshots/content-snapshot.service';
import { ContentQueryRequestDto } from '../dto/requests/content-query.request.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequestUser } from '../../../common/interfaces/request-user.interface';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { UserRole } from '@prisma/client';

@Controller('websites/:websiteId')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContentController {
  constructor(
    private readonly contentTypeService: ContentTypeService,
    private readonly contentRetrievalService: ContentRetrievalService,
    private readonly contentSnapshotService: ContentSnapshotService,
  ) {}

  /**
   * Discovers and refreshes all WordPress post types and their schemas.
   * Returns a clean, concise summary of eligible editorial content types.
   */
  @Post('content-types/discover')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Content types discovered and registered successfully')
  async discoverContentTypes(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const types = await this.contentTypeService.discoverAndSync(websiteId, user.id);
    return types.map(this.toContentTypeSummary);
  }

  /**
   * Lists all registered active content types for this website (Blog, Tours, etc.)
   */
  @Get('content-types')
  @ResponseMessage('Content types retrieved successfully')
  async listContentTypes(@Param('websiteId', ParseUUIDPipe) websiteId: string) {
    const types = await this.contentTypeService.findByWebsite(websiteId);
    return types.map(this.toContentTypeSummary);
  }

  /**
   * Helper to format content types cleanly for the UI without bloated internal schemas.
   */
  private toContentTypeSummary(item: any) {
    const taxonomies = Array.isArray(item.taxonomies)
      ? item.taxonomies.map((t: any) => t.name || t.slug)
      : [];

    return {
      id: item.id,
      websiteId: item.websiteId,
      slug: item.slug,
      name: item.name,
      description: item.description,
      restNamespace: item.restNamespace,
      restBase: item.restBase,
      hierarchical: item.hierarchical,
      taxonomies,
      schemaStatus: item.schemaStatus,
      isActive: item.isActive,
      lastDiscoveredAt: item.lastDiscoveredAt,
    };
  }

  /**
   * Retrieves schema and taxonomy details of a specific content type.
   */
  @Get('content-types/:slug')
  @ResponseMessage('Content type details retrieved successfully')
  async getContentTypeDetails(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Param('slug') slug: string,
  ) {
    const item = await this.contentTypeService.findByWebsiteAndSlug(websiteId, slug);
    const taxonomies = Array.isArray(item.taxonomies)
      ? item.taxonomies.map((t: any) => ({
          name: t.name,
          slug: t.slug,
          hierarchical: Boolean(t.hierarchical),
        }))
      : [];

    const supportedFeatures =
      item.supports && typeof item.supports === 'object'
        ? Object.keys(item.supports).filter((k) => (item.supports as any)[k] === true)
        : [];

    const acfFields = (item.schema as any)?.properties?.acf?.fields || [];

    return {
      id: item.id,
      websiteId: item.websiteId,
      slug: item.slug,
      name: item.name,
      description: item.description,
      restNamespace: item.restNamespace,
      restBase: item.restBase,
      hierarchical: item.hierarchical,
      supports: supportedFeatures,
      taxonomies,
      acfFields,
      schemaStatus: item.schemaStatus,
      isActive: item.isActive,
      lastDiscoveredAt: item.lastDiscoveredAt,
    };
  }

  /**
   * Lists live records from WordPress for a specific content type with search & pagination.
   */
  @Get('content/:contentTypeSlug')
  @ResponseMessage('Live content records retrieved successfully')
  async listLiveContent(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Param('contentTypeSlug') contentTypeSlug: string,
    @Query() query: ContentQueryRequestDto,
  ) {
    return this.contentRetrievalService.listLiveContent(websiteId, contentTypeSlug, query);
  }

  /**
   * Retrieves a single full live record from WordPress by its WordPress Post ID.
   */
  @Get('content/:contentTypeSlug/:wpPostId')
  @ResponseMessage('Live content item retrieved successfully')
  async getLiveContentItem(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Param('contentTypeSlug') contentTypeSlug: string,
    @Param('wpPostId', ParseIntPipe) wpPostId: number,
  ) {
    const result = await this.contentRetrievalService.getLiveContentItem(
      websiteId,
      contentTypeSlug,
      wpPostId,
    );
    return result.cleanItem;
  }

  /**
   * Ingests a live record into PostgreSQL as a ContentSnapshot to begin the AI enhancement workflow.
   */
  @Post('content/:contentTypeSlug/:wpPostId/ingest')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Content snapshot captured successfully for workflow')
  async ingestSnapshot(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Param('contentTypeSlug') contentTypeSlug: string,
    @Param('wpPostId', ParseIntPipe) wpPostId: number,
    @CurrentUser() user: RequestUser,
  ) {
    const snapshot = await this.contentSnapshotService.createOrUpdateSnapshot(
      websiteId,
      contentTypeSlug,
      wpPostId,
      user.id,
    );

    return {
      id: snapshot.id,
      websiteId: snapshot.websiteId,
      wpPostId: snapshot.wpPostId,
      slug: snapshot.slug,
      title: snapshot.title,
      wpStatus: snapshot.wpStatus,
      wpUrl: snapshot.wpUrl,
      workflowStatus: snapshot.workflowStatus,
      featuredMediaUrl: snapshot.featuredMediaUrl,
      customFields: snapshot.customFields,
      taxonomiesData: snapshot.taxonomiesData,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    };
  }
}
