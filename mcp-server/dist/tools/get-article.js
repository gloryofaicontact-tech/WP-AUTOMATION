export const getArticleTool = {
    name: 'get_article',
    description: 'Fetch full details of a backend-managed article/draft by its articleId, including HTML content, SEO metadata, custom fields, and discovered image placeholders.',
    inputSchema: {
        type: 'object',
        properties: {
            websiteId: {
                type: 'string',
                description: 'The website UUID from list_my_websites',
            },
            articleId: {
                type: 'string',
                description: 'The article UUID from list_articles or send_article_to_backend',
            },
        },
        required: ['websiteId', 'articleId'],
    },
};
export async function getArticle(client, args) {
    const a = await client.get(`/websites/${args.websiteId}/articles/${args.articleId}`);
    let out = `## ${a.title}\n\n`;
    out += `- **Article ID:** \`${a.id}\`\n`;
    out += `- **Slug:** \`${a.slug ?? '—'}\` | **Type:** \`${a.contentType?.slug ?? '—'}\`\n`;
    out += `- **Workflow:** \`${a.workflowStatus}\` | **WP Status:** \`${a.wpStatus ?? '—'}\`\n`;
    out += `- **WP Post ID:** ${a.wpPostId ?? '—'}${a.wpUrl ? ` | **URL:** ${a.wpUrl}` : ''}\n`;
    if (a.focusKeyword)
        out += `- **Focus Keyword:** ${a.focusKeyword}\n`;
    if (a.metaDescription)
        out += `- **Meta Description:** ${a.metaDescription}\n`;
    if (a.featuredMediaUrl)
        out += `- **Featured Image:** ${a.featuredMediaUrl}\n`;
    if (a.images && a.images.length > 0) {
        out += `\n### Images (${a.images.length})\n`;
        for (const img of a.images) {
            out += `- **${img.placeholderId ?? img.position}** (${img.isPreviewOnly ? '⚠️ Preview Only' : '✅ Licensed'})\n`;
            if (img.selectedAsset?.previewUrl)
                out += `  - URL: ${img.selectedAsset.previewUrl}\n`;
            if (img.elementsSearchUrl)
                out += `  - Envato Elements: ${img.elementsSearchUrl}\n`;
        }
    }
    if (a.customFields && Object.keys(a.customFields).length > 0) {
        out += `\n### Custom Fields (ACF)\n\`\`\`json\n${JSON.stringify(a.customFields, null, 2)}\n\`\`\`\n`;
    }
    if (a.contentHtml) {
        out += `\n### Content HTML\n\`\`\`html\n${a.contentHtml}\n\`\`\`\n`;
    }
    return out;
}
