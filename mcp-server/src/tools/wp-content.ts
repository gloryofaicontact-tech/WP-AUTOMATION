import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';

export const listWpContentTool: Tool = {
  name: 'list_wp_content',
  description:
    'Search and list LIVE content directly from WordPress (including posts/pages created outside the backend, such as existing Tour Packages or Destinations). Returns wpPostId, title, slug, status, and URL.',
  inputSchema: {
    type: 'object',
    properties: {
      websiteId: {
        type: 'string',
        description: 'The website UUID from list_my_websites',
      },
      contentTypeSlug: {
        type: 'string',
        description: 'Post type slug (e.g. "post", "tour-package", "destination")',
      },
      search: {
        type: 'string',
        description: 'Optional search keyword (matches WordPress title/content/slug)',
      },
      status: {
        type: 'string',
        description: 'Optional WordPress status filter (e.g. "publish", "draft", "any")',
      },
      page: {
        type: 'number',
        description: 'Page number (default: 1)',
        default: 1,
      },
      limit: {
        type: 'number',
        description: 'Items per page (default: 10, max: 100)',
        default: 10,
      },
    },
    required: ['websiteId', 'contentTypeSlug'],
  },
};

export const getWpContentItemTool: Tool = {
  name: 'get_wp_content_item',
  description:
    'Fetch the full live WordPress post/package/destination by its WordPress Post ID (wpPostId), including full HTML content, ACF custom fields, featured image, and URL. Use list_wp_content first to find the wpPostId.',
  inputSchema: {
    type: 'object',
    properties: {
      websiteId: {
        type: 'string',
        description: 'The website UUID from list_my_websites',
      },
      contentTypeSlug: {
        type: 'string',
        description: 'Post type slug (e.g. "post", "tour-package", "destination")',
      },
      wpPostId: {
        type: 'number',
        description: 'The WordPress Post ID from list_wp_content',
      },
    },
    required: ['websiteId', 'contentTypeSlug', 'wpPostId'],
  },
};

interface LiveItemSummary {
  wpPostId?: number;
  id?: number;
  title: string;
  slug?: string;
  status?: string;
  wpStatus?: string;
  link?: string;
  wpUrl?: string;
  date?: string;
  excerpt?: string;
}

export async function listWpContent(
  client: BackendClient,
  args: {
    websiteId: string;
    contentTypeSlug: string;
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  },
): Promise<string> {
  const page = args.page ?? 1;
  const limit = Math.min(args.limit ?? 10, 100);
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (args.search?.trim()) params.set('search', args.search.trim());
  if (args.status?.trim()) params.set('status', args.status.trim());

  const res = await client.get<{
    items?: LiveItemSummary[];
    data?: LiveItemSummary[];
    pagination?: { total?: number; totalPages?: number };
    meta?: {
      total?: number;
      pagination?: { totalItems?: number; totalPages?: number };
    };
  }>(
    `/websites/${args.websiteId}/content/${encodeURIComponent(args.contentTypeSlug)}?${params.toString()}`,
  );

  const items = res.items ?? res.data ?? (Array.isArray(res) ? (res as unknown as LiveItemSummary[]) : []);
  if (!Array.isArray(items) || items.length === 0) {
    return `No live WordPress items found for \`${args.contentTypeSlug}\`${args.search ? ` matching "${args.search}"` : ''}.`;
  }

  const rows = items.map((item, i) => {
    const postId = item.wpPostId ?? item.id ?? '—';
    const st = item.status ?? item.wpStatus ?? '—';
    const url = item.link ?? item.wpUrl;
    return (
      `${(page - 1) * limit + i + 1}. **${item.title}**\n` +
      `   - WP Post ID: \`${postId}\` | Slug: \`${item.slug ?? '—'}\` | Status: \`${st}\`\n` +
      `${url ? `   - URL: ${url}\n` : ''}`
    ).trimEnd();
  });

  let out = `## Live WordPress \`${args.contentTypeSlug}\` Items (Page ${page})\n\n${rows.join('\n\n')}`;
  const total = res.meta?.pagination?.totalItems ?? res.pagination?.total ?? res.meta?.total;
  out += `\n\n> ${total !== undefined ? `Showing ${items.length} of ${total} live WordPress items. ` : ''}To read full HTML, ACF custom fields, and layout, call \`get_wp_content_item\` with \`wpPostId\` (do not web-fetch the public URL).`;
  return out;
}

export async function getWpContentItem(
  client: BackendClient,
  args: { websiteId: string; contentTypeSlug: string; wpPostId: number },
): Promise<string> {
  const item = await client.get<{
    wpPostId?: number;
    id?: number;
    title: string;
    slug?: string;
    status?: string;
    link?: string;
    wpUrl?: string;
    content?: string;
    rawContent?: string;
    excerpt?: string;
    featuredMediaUrl?: string;
    featuredMedia?: { id?: number; sourceUrl?: string; altText?: string } | null;
    acf?: Record<string, unknown>;
    customFields?: Record<string, unknown>;
  }>(
    `/websites/${args.websiteId}/content/${encodeURIComponent(args.contentTypeSlug)}/${args.wpPostId}`,
  );

  const postId = item.wpPostId ?? item.id ?? args.wpPostId;
  const url = item.link ?? item.wpUrl;
  const html = item.content ?? item.rawContent;
  const acf = item.acf ?? item.customFields;
  const featuredImg = item.featuredMedia?.sourceUrl ?? item.featuredMediaUrl;

  let out = `## ${item.title}\n\n`;
  out += `- **WP Post ID:** \`${postId}\` | **Slug:** \`${item.slug ?? '—'}\`\n`;
  if (item.status) out += `- **Status:** \`${item.status}\`\n`;
  if (url) out += `- **URL:** ${url}\n`;
  if (featuredImg) out += `- **Featured Image:** ${featuredImg}\n`;
  if (item.excerpt) out += `- **Excerpt:** ${item.excerpt}\n`;

  if (acf && Object.keys(acf).length > 0) {
    out += `\n### ACF / Custom Fields\n\`\`\`json\n${JSON.stringify(acf, null, 2)}\n\`\`\`\n`;
  }

  if (html) {
    out += `\n### Content HTML\n\`\`\`html\n${html}\n\`\`\`\n`;
  }

  return out;
}
