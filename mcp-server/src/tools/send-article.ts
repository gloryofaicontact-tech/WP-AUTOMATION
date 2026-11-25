import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';

export const sendArticleTool: Tool = {
  name: 'send_article_to_backend',
  description:
    'Send an article to the WP-Automation backend to discover Envato images and save a WordPress draft. ' +
    'PREFERRED (Structured Mode): If you already matched an existing live layout/schema via get_wp_content_item and get_content_types, ' +
    'pass `title` + `contentHtml` (+ optional `slug`, `focusKeyword`, `metaDescription`, `customFields`, `imagePlaceholders`) to preserve your exact HTML/ACF and skip redundant backend AI parsing. ' +
    'FALLBACK (Raw Mode): Pass `rawContent` to let the backend AI parse plain text.',
  inputSchema: {
    type: 'object',
    properties: {
      websiteId: {
        type: 'string',
        description: 'The website UUID from list_my_websites',
      },
      contentTypeSlug: {
        type: 'string',
        description:
          'The post type slug from get_content_types (e.g. "post", "tour-package", "destination")',
      },
      title: {
        type: 'string',
        description: 'Structured Mode: Final article title (required with contentHtml when bypassing backend AI)',
      },
      contentHtml: {
        type: 'string',
        description: 'Structured Mode: Final clean HTML content matching your target site layout',
      },
      slug: {
        type: 'string',
        description: 'Structured Mode: Optional URL slug (auto-generated from title if omitted)',
      },
      focusKeyword: {
        type: 'string',
        description: 'Structured Mode: Primary SEO focus keyword',
      },
      metaDescription: {
        type: 'string',
        description: 'Structured Mode: SEO meta description (150-160 chars)',
      },
      categorySlugs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Structured Mode: Category slugs',
      },
      tagSlugs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Structured Mode: Tag slugs',
      },
      customFields: {
        type: 'object',
        description: 'Structured Mode: ACF / custom field key-value pairs matching get_content_types(slug)',
      },
      imagePlaceholders: {
        type: 'array',
        description:
          'Structured Mode: Optional 2-3 word Envato search keywords for featured/inline images.',
        items: {
          type: 'object',
          properties: {
            position: {
              type: 'string',
              enum: ['featured_hero', 'after_h2_1', 'after_h2_2', 'after_h2_3', 'content_middle', 'content_end'],
            },
            recommendedSearch: {
              type: 'string',
              description: 'Short 2-3 word stock photo keyword (e.g. "sri lanka temple")',
            },
            fallbackSearch: {
              type: 'string',
              description: 'Broader 2-word fallback keyword (e.g. "ancient ruins")',
            },
            altText: { type: 'string' },
            targetHeading: { type: 'string' },
          },
          required: ['recommendedSearch'],
        },
      },
      rawContent: {
        type: 'string',
        description:
          'Raw Mode fallback: Unstructured plain text / markdown if you want the backend AI to format it.',
      },
      autoPublish: {
        type: 'boolean',
        description:
          'If true, attempts to publish to WordPress immediately. Note: publishing is blocked if unreplaced Envato preview images remain unless allowPreviewImages is true. Default: false (saves as draft).',
        default: false,
      },
      allowPreviewImages: {
        type: 'boolean',
        description:
          'Only used when autoPublish is true. Set true to allow publishing even with Envato preview URLs.',
        default: false,
      },
    },
    required: ['websiteId', 'contentTypeSlug'],
  },
};

interface ProcessResponse {
  id: string;
  title: string;
  slug?: string;
  focusKeyword?: string;
  metaDescription?: string;
  workflowStatus: string;
  wpStatus?: string;
  wpPostId?: number;
  featuredMediaUrl?: string | null;
  summaryNotes?: string;
  images?: Array<{
    placeholderId?: string;
    position?: string;
    recommendedSearch?: string;
    elementsSearchUrl?: string;
    isPreviewOnly?: boolean;
    selectedAsset?: {
      title?: string;
      previewUrl?: string;
      sourceUrl?: string;
    };
  }>;
  createdAt: string;
}

export interface SendArticleArgs {
  websiteId: string;
  contentTypeSlug: string;
  rawContent?: string;
  title?: string;
  contentHtml?: string;
  slug?: string;
  focusKeyword?: string;
  metaDescription?: string;
  categorySlugs?: string[];
  tagSlugs?: string[];
  customFields?: Record<string, unknown>;
  imagePlaceholders?: Array<{
    position?: string;
    recommendedSearch: string;
    fallbackSearch?: string;
    altText?: string;
    targetHeading?: string;
  }>;
  autoPublish?: boolean;
  allowPreviewImages?: boolean;
}

export async function sendArticle(
  client: BackendClient,
  args: SendArticleArgs,
): Promise<string> {
  const isStructured = Boolean(args.title?.trim() && args.contentHtml?.trim());
  if (!isStructured && !args.rawContent?.trim()) {
    throw new Error(
      'Provide either `title` + `contentHtml` (Structured Mode) or `rawContent` (Raw Mode).',
    );
  }

  console.error(
    `[MCP] Sending article to backend (website: ${args.websiteId}, type: ${args.contentTypeSlug}, mode: ${isStructured ? 'structured' : 'raw-ai'})...`,
  );

  const payload: Record<string, unknown> = {
    contentTypeSlug: args.contentTypeSlug,
  };
  if (args.rawContent !== undefined) payload.rawDocument = args.rawContent;
  if (args.title !== undefined) payload.title = args.title;
  if (args.contentHtml !== undefined) payload.contentHtml = args.contentHtml;
  if (args.slug !== undefined) payload.slug = args.slug;
  if (args.focusKeyword !== undefined) payload.focusKeyword = args.focusKeyword;
  if (args.metaDescription !== undefined) payload.metaDescription = args.metaDescription;
  if (args.categorySlugs !== undefined) payload.categorySlugs = args.categorySlugs;
  if (args.tagSlugs !== undefined) payload.tagSlugs = args.tagSlugs;
  if (args.customFields !== undefined) payload.customFields = args.customFields;
  if (args.imagePlaceholders !== undefined) payload.imagePlaceholders = args.imagePlaceholders;

  const article = await client.post<ProcessResponse>(
    `/websites/${args.websiteId}/articles/process`,
    payload,
  );

  let result = `## ✅ Article Saved as Draft (${isStructured ? 'Structured Mode — Direct' : 'AI Parsed'})\n\n`;
  result += `- **Title:** ${article.title}\n`;
  result += `- **Slug:** \`${article.slug ?? '—'}\`\n`;
  result += `- **Article ID:** \`${article.id}\`\n`;
  result += `- **Status:** ${article.workflowStatus} (WP: ${article.wpStatus ?? 'draft'})\n`;
  if (article.focusKeyword) result += `- **Focus Keyword:** ${article.focusKeyword}\n`;
  if (article.metaDescription) result += `- **Meta Description:** ${article.metaDescription}\n`;
  result += `- **Created:** ${new Date(article.createdAt).toLocaleString()}\n`;

  if (article.images && article.images.length > 0) {
    result += `\n### 🖼️ Discovered Media Placeholders (${article.images.length})\n`;
    for (const img of article.images) {
      result += `- **${img.position ?? img.placeholderId}** (\`${img.recommendedSearch ?? ''}\`)\n`;
      if (img.selectedAsset?.previewUrl) {
        result += `  - Preview: ${img.selectedAsset.previewUrl}\n`;
      }
      if (img.elementsSearchUrl) {
        result += `  - Envato Elements: ${img.elementsSearchUrl}\n`;
      }
      if (img.isPreviewOnly) {
        result += `  - ⚠️ *Preview only — upload licensed image in dashboard before publishing live.*\n`;
      }
    }
  }

  if (args.autoPublish) {
    console.error(`[MCP] Auto-publishing article ${article.id}...`);
    try {
      const pub = await client.post<{
        wpPostId?: number;
        wpUrl?: string;
        workflowStatus: string;
      }>(`/websites/${args.websiteId}/articles/${article.id}/publish`, {
        status: 'publish',
        allowPreviewImages: Boolean(args.allowPreviewImages),
      });
      result += `\n---\n## 🚀 Published to WordPress\n\n`;
      result += `- **WordPress Post ID:** ${pub.wpPostId ?? 'N/A'}\n`;
      if (pub.wpUrl) result += `- **Live URL:** ${pub.wpUrl}\n`;
      result += `- **Status:** ${pub.workflowStatus}\n`;
    } catch (pubErr) {
      const msg = pubErr instanceof Error ? pubErr.message : String(pubErr);
      result += `\n---\n## ⚠️ Draft Saved, Auto-Publish Blocked\n\n${msg}\n`;
    }
  } else {
    result += `\n> Use \`get_article\` to inspect HTML/fields, \`update_article\` to edit, or \`publish_article\` to publish.`;
  }

  return result;
}
