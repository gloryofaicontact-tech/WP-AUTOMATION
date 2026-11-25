import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';

export const updateArticleTool: Tool = {
  name: 'update_article',
  description:
    'Update an existing backend draft/article (title, slug, focusKeyword, metaDescription, contentHtml, customFields, categories, or tags) without recreating it.',
  inputSchema: {
    type: 'object',
    properties: {
      websiteId: {
        type: 'string',
        description: 'The website UUID from list_my_websites',
      },
      articleId: {
        type: 'string',
        description: 'The article UUID to update',
      },
      title: { type: 'string', description: 'Updated article title' },
      slug: { type: 'string', description: 'Updated URL slug' },
      focusKeyword: { type: 'string', description: 'Updated SEO focus keyword' },
      metaDescription: { type: 'string', description: 'Updated SEO meta description' },
      contentHtml: { type: 'string', description: 'Updated full HTML content' },
      categorySlugs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated category slugs',
      },
      tagSlugs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated tag slugs',
      },
      customFields: {
        type: 'object',
        description: 'Updated ACF / custom field key-value pairs',
      },
    },
    required: ['websiteId', 'articleId'],
  },
};

export async function updateArticle(
  client: BackendClient,
  args: {
    websiteId: string;
    articleId: string;
    title?: string;
    slug?: string;
    focusKeyword?: string;
    metaDescription?: string;
    contentHtml?: string;
    categorySlugs?: string[];
    tagSlugs?: string[];
    customFields?: Record<string, unknown>;
  },
): Promise<string> {
  const { websiteId, articleId, ...payload } = args;
  const updated = await client.patch<{
    id: string;
    title: string;
    slug?: string;
    focusKeyword?: string;
    metaDescription?: string;
    updatedAt: string;
  }>(`/websites/${websiteId}/articles/${articleId}`, payload);

  return (
    `## ✅ Article Draft Updated\n\n` +
    `- **Article ID:** \`${updated.id}\`\n` +
    `- **Title:** ${updated.title}\n` +
    `- **Slug:** \`${updated.slug ?? '—'}\`\n` +
    `- **Updated:** ${new Date(updated.updatedAt).toLocaleString()}`
  );
}
