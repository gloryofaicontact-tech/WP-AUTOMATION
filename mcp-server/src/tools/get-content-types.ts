import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';

export const getContentTypesTool: Tool = {
  name: 'get_content_types',
  description:
    'Lists all available content types (post types) for a WordPress site — e.g. post, tour-package, destination. Pass an optional slug to also inspect its ACF custom fields, taxonomies, and supported features.',
  inputSchema: {
    type: 'object',
    properties: {
      websiteId: {
        type: 'string',
        description: 'The website UUID from list_my_websites',
      },
      slug: {
        type: 'string',
        description:
          'Optional content type slug (e.g. "tour-package", "destination") to inspect its ACF fields and taxonomies.',
      },
    },
    required: ['websiteId'],
  },
};

export async function getContentTypes(
  client: BackendClient,
  args: { websiteId: string; slug?: string },
): Promise<string> {
  if (args.slug?.trim()) {
    const ct = await client.get<{
      id: string;
      slug: string;
      name: string;
      description?: string;
      supports?: string[];
      taxonomies?: Array<{ name: string; slug: string; hierarchical?: boolean }>;
      acfFields?: unknown[];
    }>(`/websites/${args.websiteId}/content-types/${encodeURIComponent(args.slug.trim())}`);

    let out = `## Content Type: ${ct.name} (\`${ct.slug}\`)\n\n`;
    if (ct.description) out += `${ct.description}\n\n`;
    if (ct.supports?.length) out += `- **Supports:** ${ct.supports.join(', ')}\n`;
    if (ct.taxonomies?.length) {
      out += `- **Taxonomies:** ${ct.taxonomies.map((t) => `${t.name} (\`${t.slug}\`)`).join(', ')}\n`;
    }
    if (ct.acfFields && ct.acfFields.length > 0) {
      out += `\n### ACF / Custom Fields Schema\n\`\`\`json\n${JSON.stringify(ct.acfFields, null, 2)}\n\`\`\`\n`;
    } else {
      out += `\n> No ACF custom fields detected for this content type.\n`;
    }
    return out;
  }

  const data = await client.get<
    Array<{
      id: string;
      slug: string;
      name: string;
      description?: string;
      taxonomies?: string[];
    }>
  >(`/websites/${args.websiteId}/content-types`);

  const types = Array.isArray(data) ? data : (data as unknown as { data: typeof data }).data ?? [];

  if (!Array.isArray(types) || types.length === 0) {
    return 'No content types found for this site. Make sure the site was scanned after adding.';
  }

  const rows = types.map(
    (ct, i) =>
      `${i + 1}. **${ct.name}** — slug: \`${ct.slug}\`` +
      `${ct.taxonomies?.length ? ` (Taxonomies: ${ct.taxonomies.join(', ')})` : ''}` +
      `${ct.description ? `\n   ${ct.description}` : ''}`,
  );

  return `## Content Types for Site\n\n${rows.join('\n\n')}\n\n> Pass \`slug\` to \`get_content_types\` to inspect ACF fields, or use \`slug\` as \`contentTypeSlug\` in \`send_article_to_backend\` / \`list_wp_content\`.`;
}
