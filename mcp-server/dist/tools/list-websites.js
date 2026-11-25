export const listWebsitesTool = {
    name: 'list_my_websites',
    description: 'Returns all WordPress websites registered in the WP-Automation backend for the authenticated user. Use this first to get the websiteId needed for other tools.',
    inputSchema: {
        type: 'object',
        properties: {},
        required: [],
    },
};
export async function listWebsites(client) {
    const data = await client.get('/websites');
    const sites = data.data ?? data;
    if (!Array.isArray(sites) || sites.length === 0) {
        return 'No websites found. Add a WordPress site via the backend first.';
    }
    const rows = sites.map((s, i) => `${i + 1}. **${s.name}** (${s.url})\n   - ID: \`${s.id}\`\n   - Status: ${s.status ?? 'active'}`);
    return `## Your WordPress Sites\n\n${rows.join('\n\n')}`;
}
