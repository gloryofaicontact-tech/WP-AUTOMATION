import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';

export const listArticlesTool: Tool = {
  name: 'list_articles',
  description:
    'List all articles (drafts and published) for a WordPress site. Shows title, status, WordPress post ID, and article ID.',
  inputSchema: {
    type: 'object',
    properties: {
      websiteId: {
        type: 'string',
        description: 'The website UUID from list_my_websites',
      },
      page: {
        type: 'number',
        description: 'Page number (default: 1)',
        default: 1,
      },
      limit: {
        type: 'number',
        description: 'Results per page (default: 10, max: 50)',
        default: 10,
      },
    },
    required: ['websiteId'],
  },
};

export async function listArticles(
  client: BackendClient,
  args: { websiteId: string; page?: number; limit?: number },
): Promise<string> {
  const page = args.page ?? 1;
  const limit = Math.min(args.limit ?? 10, 50);

  const data = await client.get<{
    data: Array<{
      id: string;
      title: string;
      workflowStatus: string;
      wpPostId?: number;
      createdAt: string;
    }>;
    meta?: { total: number; page: number; limit: number };
  }>(`/websites/${args.websiteId}/articles?page=${page}&limit=${limit}`);

  const articles = data.data ?? [];
  const meta = data.meta;

  if (articles.length === 0) {
    return 'No articles found for this site.';
  }

  const rows = articles.map(
    (a, i) =>
      `${(page - 1) * limit + i + 1}. **${a.title}**\n` +
      `   - Article ID: \`${a.id}\`\n` +
      `   - Status: \`${a.workflowStatus}\`\n` +
      `   - WP Post ID: ${a.wpPostId ?? '—'}\n` +
      `   - Created: ${new Date(a.createdAt).toLocaleDateString()}`,
  );

  let result = `## Articles (Page ${page})\n\n${rows.join('\n\n')}`;
  if (meta) {
    result += `\n\n> Showing ${articles.length} of ${meta.total} total articles.`;
  }
  return result;
}
