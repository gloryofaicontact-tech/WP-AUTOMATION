import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';

export const sendArticleTool: Tool = {
  name: 'send_article_to_backend',
  description:
    'Send a raw article (plain text, markdown, or pasted content) to the WP-Automation backend. The backend uses AI to structure it into SEO-ready HTML, discovers Envato images, and saves a draft. Returns article ID, SEO fields, and Envato image details/links.',
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
      rawContent: {
        type: 'string',
        description:
          'The raw article text to process. Can be plain text, markdown, or HTML. The AI will restructure it.',
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
    required: ['websiteId', 'contentTypeSlug', 'rawContent'],
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

export async function sendArticle(
  client: BackendClient,
  args: {
    websiteId: string;
    contentTypeSlug: string;
    rawContent: string;
    autoPublish?: boolean;
    allowPreviewImages?: boolean;
  },
): Promise<string> {
  console.error(
    `[MCP] Sending article to backend (website: ${args.websiteId}, type: ${args.contentTypeSlug})...`,
  );

  const article = await client.post<ProcessResponse>(
    `/websites/${args.websiteId}/articles/process`,
    {
      contentTypeSlug: args.contentTypeSlug,
      rawDocument: args.rawContent,
    },
  );

  let result = `## ✅ Article Processed & Saved as Draft\n\n`;
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
