import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ArticlesManagerService } from './articles-manager.service';
import { ProcessArticleRequestDto } from './dto/process-article.dto';
import { UpdateArticleDraftDto } from './dto/update-article-draft.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { UserRole } from '@prisma/client';

@Controller('websites/:websiteId/articles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArticlesManagerController {
  constructor(private readonly articlesService: ArticlesManagerService) {}

  /**
   * Processes a raw document, generates clean semantic HTML, SEO meta,
   * matches Envato images, and saves it as an article draft.
   */
  @Post('process')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Article parsed, structured, and saved as draft successfully')
  async processArticle(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Body() dto: ProcessArticleRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.articlesService.processAndCreateDraft(websiteId, dto, user.id);
  }

  /**
   * Lists all articles for this website (both drafts and published posts).
   */
  @Get()
  @ResponseMessage('Articles retrieved successfully')
  async listArticles(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    return this.articlesService.listArticles(websiteId, pageNum, limitNum, status);
  }

  /**
   * Retrieves single article preview by its UUID.
   */
  @Get(':id')
  @ResponseMessage('Article details retrieved successfully')
  async getArticleById(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.getArticleById(id);
  }

  /**
   * Edits an article draft before publishing.
   */
  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR)
  @ResponseMessage('Article draft updated successfully')
  async updateArticleDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArticleDraftDto,
  ) {
    return this.articlesService.updateArticleDraft(id, dto);
  }

  /**
   * Publishes or updates the article directly on WordPress via the REST API.
   * Passing { "status": "draft" } unpublishes/reverts an existing post to draft on WordPress.
   * Passing { "status": "publish" } makes it live.
   */
  @Post(':id/publish')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Article published or updated on WordPress successfully')
  async publishToWordPress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status?: 'publish' | 'draft' | 'pending',
  ) {
    return this.articlesService.publishToWordPress(id, status || 'publish');
  }

  /**
   * Deletes an article from the platform and optionally trashes or permanently deletes it on WordPress.
   * Query: ?force=true (permanently delete on WordPress) or false (move to WordPress Trash, default).
   */
  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Article deleted successfully')
  async deleteArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force') force?: string,
  ) {
    const isForce = force === 'true';
    return this.articlesService.deleteArticle(id, isForce);
  }
}
