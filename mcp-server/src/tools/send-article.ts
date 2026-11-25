import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';

export const sendArticleTool: Tool = {
  name: 'send_article_to_backend',
  description:
    'Send a raw article (plain text, markdown, or pasted content) to the WP-Automation backend. The backend uses AI to structure it into SEO-ready HTML, discovers Envato images, and saves a draft. Optionally auto-publishes to WordPress immediately.',
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
          'The post type slug from get_content_types (e.g. "post", "tour-package")',
      },
      rawContent: {
        type: 'string',
        description:
          'The raw article text to process. Can be plain text, markdown, or HTML. The AI will restructure it.',
      },
      autoPublish: {
        type: 'boolean',
        description:
          'If true, the article is immediately published to WordPress after processing. Default: false (saves as draft).',
        default: false,
      },
    },
    required: ['websiteId', 'contentTypeSlug', 'rawContent'],
  },
};

interface ProcessResponse {
  id: string;
  title: string;
  workflowStatus: string;
  wpPostId?: number;
  createdAt: string;
}

export async function sendArticle(
  client: BackendClient,
  args: {
    websiteId: string;
    contentTypeSlug: string;
    rawContent: string;
    autoPublish?: boolean;
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

  let result = `## ✅ Article Processed Successfully\n\n`;
  result += `- **Title:** ${article.title}\n`;
  result += `- **Article ID:** \`${article.id}\`\n`;
  result += `- **Status:** ${article.workflowStatus}\n`;
  result += `- **Created:** ${new Date(article.createdAt).toLocaleString()}\n`;

  // Auto-publish if requested
  if (args.autoPublish) {
    console.error(`[MCP] Auto-publishing article ${article.id}...`);
    const pub = await client.post<{ wpPostId?: number; workflowStatus: string }>(
      `/websites/${args.websiteId}/articles/${article.id}/publish`,
      { status: 'publish' },
    );
    result += `\n---\n## 🚀 Published to WordPress\n\n`;
    result += `- **WordPress Post ID:** ${pub.wpPostId ?? 'N/A'}\n`;
    result += `- **Status:** ${pub.workflowStatus}\n`;
  } else {
    result += `\n> Article saved as draft. Use \`publish_article\` with article ID \`${article.id}\` to publish it.`;
  }

  return result;
}
