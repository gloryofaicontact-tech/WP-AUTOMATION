export const listArticlesTool = {
    name: 'list_articles',
    description: 'List all backend-managed articles (drafts and published) for a WordPress site. Shows title, slug, content type, status, WordPress post ID, live URL, and article ID.',
    inputSchema: {
        type: 'object',
        properties: {
            websiteId: {
                type: 'string',
                description: 'The website UUID from list_my_websites',
            },
            status: {
                type: 'string',
                description: 'Optional workflow status filter (e.g. "IMPORTED" for drafts, "PUBLISHED" for published)',
            },
            page: {
                type: 'number',
                description: 'Page number (default: 1)',
                default: 1,
            },
            limit: {
                type: 'number',
                description: 'Results per page (default: 20, max: 100)',
                default: 20,
            },
        },
        required: ['websiteId'],
    },
};
export async function listArticles(client, args) {
    const page = args.page ?? 1;
    const limit = Math.min(args.limit ?? 20, 100);
    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
    });
    if (args.status?.trim()) {
        params.set('status', args.status.trim());
    }
    const data = await client.get(`/websites/${args.websiteId}/articles?${params.toString()}`);
    const articles = data.items ?? data.data ?? [];
    const pagination = data.pagination ?? data.meta;
    if (articles.length === 0) {
        return ('No backend-managed articles/drafts found for this site. ' +
            'Note: to search existing posts created directly in WordPress, use `list_wp_content`.');
    }
    const rows = articles.map((a, i) => `${(page - 1) * limit + i + 1}. **${a.title}**\n` +
        `   - Article ID: \`${a.id}\`\n` +
        `   - Slug: \`${a.slug ?? '—'}\` | Type: \`${a.contentTypeSlug ?? a.contentType ?? '—'}\`\n` +
        `   - Workflow: \`${a.workflowStatus}\` | WP Status: \`${a.wpStatus ?? '—'}\`\n` +
        `   - WP Post ID: ${a.wpPostId ?? '—'}${a.wpUrl ? ` | URL: ${a.wpUrl}` : ''}\n` +
        `   - Created: ${new Date(a.createdAt).toLocaleDateString()}`);
    let result = `## Backend Articles & Drafts (Page ${page})\n\n${rows.join('\n\n')}`;
    if (pagination) {
        result += `\n\n> Showing ${articles.length} of ${pagination.total} total records.`;
    }
    return result;
}
