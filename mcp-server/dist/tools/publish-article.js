export const publishArticleTool = {
    name: 'publish_article',
    description: 'Publish, unpublish (revert to draft), or delete a backend article by its ID.',
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
            action: {
                type: 'string',
                enum: ['publish', 'unpublish', 'delete', 'delete_permanent'],
                description: '"publish" → push to WordPress live. "unpublish" → revert to draft on WordPress. "delete" → trash. "delete_permanent" → permanently delete.',
            },
            allowPreviewImages: {
                type: 'boolean',
                description: 'Set true to publish even if Envato preview images have not been replaced with licensed uploads yet.',
                default: false,
            },
        },
        required: ['websiteId', 'articleId', 'action'],
    },
};
export async function publishArticle(client, args) {
    const { websiteId, articleId, action, allowPreviewImages } = args;
    if (action === 'delete' || action === 'delete_permanent') {
        const force = action === 'delete_permanent';
        await client.delete(`/websites/${websiteId}/articles/${articleId}${force ? '?force=true' : ''}`);
        return `## 🗑️ Article ${force ? 'Permanently Deleted' : 'Trashed'}\n\n- **Article ID:** \`${articleId}\``;
    }
    const status = action === 'publish' ? 'publish' : 'draft';
    const res = await client.post(`/websites/${websiteId}/articles/${articleId}/publish`, {
        status,
        ...(allowPreviewImages ? { allowPreviewImages: true } : {}),
    });
    const liveUrl = res.wpUrl || res.wpPostUrl;
    if (action === 'publish') {
        let result = `## 🚀 Article Published to WordPress\n\n`;
        result += `- **Article ID:** \`${articleId}\`\n`;
        result += `- **WordPress Post ID:** ${res.wpPostId ?? 'N/A'}\n`;
        result += `- **Status:** ${res.workflowStatus}\n`;
        if (liveUrl)
            result += `- **URL:** ${liveUrl}\n`;
        return result;
    }
    return `## 📝 Article Reverted to Draft\n\n- **Article ID:** \`${articleId}\`\n- **WP Post ID:** ${res.wpPostId ?? 'N/A'}\n- **Status:** ${res.workflowStatus}`;
}
