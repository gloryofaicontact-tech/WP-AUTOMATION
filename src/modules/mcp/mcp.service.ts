import { Injectable, Logger } from '@nestjs/common';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MCP_TOOLS } from './mcp.tools';
import { WebsitesService } from '../websites/websites.service';
import { ContentTypeService } from '../Articles/registry/content-type.service';
import { ContentRetrievalService } from '../Articles/retrieval/content-retrieval.service';
import { ArticlesManagerService } from '../articles-manager/articles-manager.service';
import { RequestUser } from '../../common/interfaces/request-user.interface';

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly websitesService: WebsitesService,
    private readonly contentTypeService: ContentTypeService,
    private readonly contentRetrievalService: ContentRetrievalService,
    private readonly articlesManagerService: ArticlesManagerService,
  ) {}

  /**
   * Creates a stateless MCP Server instance bound to the authenticated user.
   */
  createServerForUser(user: RequestUser): Server {
    const server = new Server(
      { name: 'wp-automation-mcp', version: '1.2.0' },
      { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: MCP_TOOLS,
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        const text = await this.executeTool(name, (args || {}) as Record<string, any>, user);
        return { content: [{ type: 'text', text }] };
      } catch (err: any) {
        const message = err?.response?.message || err?.message || String(err);
        this.logger.warn(`MCP tool "${name}" failed: ${message}`);
        return {
          content: [{ type: 'text', text: `## ❌ Error\n\n\`\`\`\n${message}\n\`\`\`` }],
          isError: true,
        };
      }
    });

    return server;
  }

  private async executeTool(
    name: string,
    args: Record<string, any>,
    user: RequestUser,
  ): Promise<string> {
    switch (name) {
      case 'list_my_websites': {
        const res = await this.websitesService.findAll({ page: 1, limit: 50 } as any);
        const sites = res.data || [];
        if (sites.length === 0) {
          return 'No websites found. Add a WordPress site in the dashboard first.';
        }
        return (
          '## Your WordPress Sites\n\n' +
          sites
            .map(
              (s, i) =>
                `${i + 1}. **${s.name}** (${s.url})\n   - ID: \`${s.id}\`\n   - Status: ${s.status}`,
            )
            .join('\n\n')
        );
      }

      case 'get_content_types': {
        if (args.slug?.trim()) {
          const item = await this.contentTypeService.findByWebsiteAndSlug(
            args.websiteId,
            args.slug.trim(),
          );
          const taxonomies = Array.isArray(item.taxonomies) ? (item.taxonomies as any[]) : [];
          const supports =
            item.supports && typeof item.supports === 'object'
              ? Object.keys(item.supports).filter((k) => (item.supports as any)[k] === true)
              : [];
          const acfFields = (item.schema as any)?.properties?.acf?.fields || [];
          const bp = (item.schema as any)?._layoutBlueprint;

          let out = `## Content Type: ${item.name} (\`${item.slug}\`)\n\n`;
          if (item.description) out += `${item.description}\n\n`;
          if (supports.length) out += `- **Supports:** ${supports.join(', ')}\n`;
          if (taxonomies.length) {
            out += `\n### Taxonomies & Existing Terms\n`;
            for (const t of taxonomies) {
              const termList = Array.isArray(t.terms) && t.terms.length
                ? t.terms.map((term: any) => `${term.name} (\`${term.slug}\`)`).join(', ')
                : 'No terms discovered yet';
              out += `- **${t.name}** (\`${t.slug}\`): ${termList}\n`;
            }
          }
          if (bp) {
            out += `\n### Detected Layout Blueprint\n`;
            out += `- **Sample Found:** ${bp.hasSamplePost ? 'Yes' : 'No'}\n`;
            out += `- **Featured Cover Image:** ${bp.hasFeaturedImage ? 'Yes' : 'No'} (Rendered in Live Template: ${bp.featuredImageRenderedInTemplate !== false ? 'Yes' : 'No — place image inside contentHtml too'}) | **Inline Images:** ${bp.inlineImageCount ?? 0}\n`;
            if (bp.acfImageFields?.length) out += `- **ACF Image Fields:** ${bp.acfImageFields.join(', ')}\n`;
            if (bp.sampleHeadings?.length) out += `- **Typical Headings:** ${bp.sampleHeadings.join(' | ')}\n`;
            if (bp.sampleMetaKeys?.length) out += `- **Meta Keys:** ${bp.sampleMetaKeys.join(', ')}\n`;
            if (bp.sampleAcfExample) {
              out += `\n#### Example ACF Values\n\`\`\`json\n${JSON.stringify(bp.sampleAcfExample, null, 2)}\n\`\`\`\n`;
            }
            if (bp.sampleHtmlSnippet) {
              out += `\n#### Clean HTML Structure Sample\n\`\`\`html\n${bp.sampleHtmlSnippet}\n\`\`\`\n`;
            }
          }
          if (acfFields.length) {
            out += `\n### ACF / Custom Fields Schema\n\`\`\`json\n${JSON.stringify(acfFields, null, 2)}\n\`\`\`\n`;
          }
          return out;
        }

        const types = await this.contentTypeService.findByWebsite(args.websiteId);
        if (!types.length) return 'No content types found. Run Discover Content Types first.';
        return (
          '## Content Types for Site\n\n' +
          types
            .map((ct, i) => `${i + 1}. **${ct.name}** — slug: \`${ct.slug}\``)
            .join('\n') +
          '\n\n> Pass `slug` to inspect ACF fields, terms, and layoutBlueprint.'
        );
      }

      case 'list_articles': {
        const res = await this.articlesManagerService.listArticles(
          args.websiteId,
          args.page ?? 1,
          Math.min(args.limit ?? 20, 100),
          args.status,
        );
        if (!res.items.length) {
          return 'No backend-managed articles/drafts found. Use `list_wp_content` to search live WordPress posts.';
        }
        return (
          `## Backend Articles & Drafts (Page ${res.pagination.page})\n\n` +
          res.items
            .map(
              (a, i) =>
                `${i + 1}. **${a.title}**\n` +
                `   - Article ID: \`${a.id}\` | Slug: \`${a.slug}\` | Type: \`${a.contentTypeSlug}\`\n` +
                `   - Workflow: \`${a.workflowStatus}\` | WP Status: \`${a.wpStatus}\` | WP Post ID: ${a.wpPostId ?? '—'}` +
                `${a.wpUrl ? ` | URL: ${a.wpUrl}` : ''}`,
            )
            .join('\n\n')
        );
      }

      case 'get_article': {
        const a = await this.articlesManagerService.getArticleById(args.articleId);
        let out = `## ${a.title}\n\n- **Article ID:** \`${a.id}\` | **Slug:** \`${a.slug}\`\n`;
        out += `- **Workflow:** \`${a.workflowStatus}\` | **WP Status:** \`${a.wpStatus}\` | **WP Post ID:** ${a.wpPostId ?? '—'}\n`;
        if (a.wpUrl) out += `- **URL:** ${a.wpUrl}\n`;
        if (a.focusKeyword) out += `- **Focus Keyword:** ${a.focusKeyword}\n`;
        if (a.metaDescription) out += `- **Meta Description:** ${a.metaDescription}\n`;
        if (a.featuredMediaUrl) out += `- **Featured Image:** ${a.featuredMediaUrl}\n`;
        if (Array.isArray(a.images) && a.images.length) {
          out += `\n### Images (${a.images.length})\n`;
          for (const img of a.images as any[]) {
            out += `- **${img.placeholderId || img.position}** (${img.isPreviewOnly ? '⚠️ Preview Only' : '✅ Licensed'})\n`;
            if (img.elementsSearchUrl) out += `  - Envato Elements: ${img.elementsSearchUrl}\n`;
          }
        }
        if (a.contentHtml) out += `\n### Content HTML\n\`\`\`html\n${a.contentHtml}\n\`\`\`\n`;
        return out;
      }

      case 'update_article': {
        const { websiteId: _w, articleId, ...payload } = args;
        const updated = await this.articlesManagerService.updateArticleDraft(articleId, payload);
        return `## ✅ Article Draft Updated\n\n- **Article ID:** \`${updated.id}\`\n- **Title:** ${updated.title}\n- **Slug:** \`${updated.slug}\``;
      }

      case 'send_article_to_backend': {
        const isStructured = Boolean(args.title?.trim() && args.contentHtml?.trim());
        const article = await this.articlesManagerService.processAndCreateDraft(
          args.websiteId,
          {
            contentTypeSlug: args.contentTypeSlug,
            rawDocument: args.rawContent,
            title: args.title,
            contentHtml: args.contentHtml,
            slug: args.slug,
            focusKeyword: args.focusKeyword,
            metaDescription: args.metaDescription,
            categorySlugs: args.categorySlugs,
            tagSlugs: args.tagSlugs,
            customFields: args.customFields,
            imagePlaceholders: args.imagePlaceholders,
          },
          user.id,
        );

        let out = `## ✅ Article Saved as Draft (${isStructured ? 'Structured Mode — Direct' : 'AI Parsed'})\n\n`;
        out += `- **Title:** ${article.title}\n- **Slug:** \`${article.slug}\`\n- **Article ID:** \`${article.id}\`\n`;
        if (article.images?.length) {
          out += `\n### 🖼️ Media Placeholders (${article.images.length})\n`;
          for (const img of article.images as any[]) {
            out += `- **${img.position || img.placeholderId}** (${img.isPreviewOnly ? '⚠️ Preview Only' : '✅ Licensed'})\n`;
            if (img.elementsSearchUrl) out += `  - Envato Elements: ${img.elementsSearchUrl}\n`;
          }
        }
        if (args.autoPublish) {
          try {
            const pub = await this.articlesManagerService.publishToWordPress(
              article.id,
              'publish',
              Boolean(args.allowPreviewImages),
            );
            out += `\n---\n## 🚀 Published\n- **WP Post ID:** ${pub.wpPostId}\n- **URL:** ${pub.wpUrl}\n`;
          } catch (e: any) {
            out += `\n---\n## ⚠️ Draft Saved, Auto-Publish Blocked\n${e?.response?.message || e?.message}\n`;
          }
        }
        return out;
      }

      case 'publish_article': {
        if (args.action === 'delete' || args.action === 'delete_permanent') {
          await this.articlesManagerService.deleteArticle(
            args.articleId,
            args.action === 'delete_permanent',
          );
          return `## 🗑️ Article Deleted\n\n- **Article ID:** \`${args.articleId}\``;
        }
        const status = args.action === 'publish' ? 'publish' : 'draft';
        const res = await this.articlesManagerService.publishToWordPress(
          args.articleId,
          status,
          Boolean(args.allowPreviewImages),
        );
        return `## ${status === 'publish' ? '🚀 Published' : '📝 Reverted to Draft'}\n\n- **WP Post ID:** ${res.wpPostId}\n- **URL:** ${res.wpUrl || '—'}`;
      }

      case 'list_wp_content': {
        const res = await this.contentRetrievalService.listLiveContent(
          args.websiteId,
          args.contentTypeSlug,
          {
            search: args.search,
            status: args.status,
            page: args.page ?? 1,
            limit: Math.min(args.limit ?? 10, 100),
          } as any,
        );
        const items = res.data || [];
        if (!items.length) return `No live WordPress items found for \`${args.contentTypeSlug}\`.`;
        return (
          `## Live WordPress \`${args.contentTypeSlug}\` Items\n\n` +
          items
            .map(
              (item: any, i: number) =>
                `${i + 1}. **${item.title}**\n   - WP Post ID: \`${item.id}\` | Slug: \`${item.slug}\` | Status: \`${item.status}\``,
            )
            .join('\n\n') +
          `\n\n> Call \`get_wp_content_item\` with \`wpPostId\` to read full HTML and ACF fields.`
        );
      }

      case 'get_wp_content_item': {
        const { cleanItem } = await this.contentRetrievalService.getLiveContentItem(
          args.websiteId,
          args.contentTypeSlug,
          Number(args.wpPostId),
        );
        let out = `## ${cleanItem.title}\n\n- **WP Post ID:** \`${cleanItem.id}\` | **Slug:** \`${cleanItem.slug}\`\n`;
        if (cleanItem.link) out += `- **URL:** ${cleanItem.link}\n`;
        if (cleanItem.featuredMedia?.sourceUrl) out += `- **Featured Image:** ${cleanItem.featuredMedia.sourceUrl}\n`;
        if (cleanItem.acf) out += `\n### ACF Fields\n\`\`\`json\n${JSON.stringify(cleanItem.acf, null, 2)}\n\`\`\`\n`;
        if (cleanItem.content) out += `\n### Content HTML\n\`\`\`html\n${cleanItem.content}\n\`\`\`\n`;
        return out;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}
