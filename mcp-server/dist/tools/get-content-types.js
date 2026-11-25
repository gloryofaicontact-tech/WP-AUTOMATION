export const getContentTypesTool = {
    name: 'get_content_types',
    description: 'Lists all available content types (post types) for a WordPress site — e.g. post, tour-package, destination. The slug returned here is what you pass as contentTypeSlug when sending an article.',
    inputSchema: {
        type: 'object',
        properties: {
            websiteId: {
                type: 'string',
                description: 'The website UUID from list_my_websites',
            },
        },
        required: ['websiteId'],
    },
};
export async function getContentTypes(client, args) {
    const data = await client.get(`/websites/${args.websiteId}/content-types`);
    const types = Array.isArray(data) ? data : data.data ?? [];
    if (!Array.isArray(types) || types.length === 0) {
        return 'No content types found for this site. Make sure the site was scanned after adding.';
    }
    const rows = types.map((ct, i) => `${i + 1}. **${ct.name}** — slug: \`${ct.slug}\`${ct.description ? `\n   ${ct.description}` : ''}`);
    return `## Content Types for Site\n\n${rows.join('\n\n')}\n\n> Use the **slug** value as \`contentTypeSlug\` in \`send_article_to_backend\`.`;
}
