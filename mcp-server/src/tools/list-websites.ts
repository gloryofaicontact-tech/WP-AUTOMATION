import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';

export const listWebsitesTool: Tool = {
  name: 'list_my_websites',
  description:
    'Returns all WordPress websites registered in the WP-Automation backend for the authenticated user. Use this first to get the websiteId needed for other tools.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export async function listWebsites(client: BackendClient): Promise<string> {
  const data = await client.get<{
    data: Array<{ id: string; name: string; url: string; status: string }>;
  }>('/websites');

  const sites = data.data ?? (data as unknown as Array<unknown>);
  if (!Array.isArray(sites) || sites.length === 0) {
    return 'No websites found. Add a WordPress site via the backend first.';
  }

  const rows = (
    sites as Array<{ id: string; name: string; url: string; status?: string }>
  ).map(
    (s, i) =>
      `${i + 1}. **${s.name}** (${s.url})\n   - ID: \`${s.id}\`\n   - Status: ${s.status ?? 'active'}`,
  );

  return `## Your WordPress Sites\n\n${rows.join('\n\n')}`;
}
