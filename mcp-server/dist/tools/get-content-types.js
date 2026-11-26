export const getContentTypesTool = {
    name: 'get_content_types',
    description: 'Lists all available content types (post types) for a WordPress site — e.g. post, tour-package, destination. Pass an optional slug to also inspect its ACF custom fields, taxonomies, and supported features.',
    inputSchema: {
        type: 'object',
        properties: {
            websiteId: {
                type: 'string',
                description: 'The website UUID from list_my_websites',
            },
            slug: {
                type: 'string',
                description: 'Optional content type slug (e.g. "tour-package", "destination") to inspect its ACF fields and taxonomies.',
            },
        },
        required: ['websiteId'],
    },
};
export async function getContentTypes(client, args) {
    if (args.slug?.trim()) {
        const ct = await client.get(`/websites/${args.websiteId}/content-types/${encodeURIComponent(args.slug.trim())}`);
        let out = `## Content Type: ${ct.name} (\`${ct.slug}\`)\n\n`;
        if (ct.description)
            out += `${ct.description}\n\n`;
        if (ct.supports?.length)
            out += `- **Supports:** ${ct.supports.join(', ')}\n`;
        if (ct.taxonomies?.length) {
            out += `\n### Taxonomies & Existing Terms\n`;
            for (const t of ct.taxonomies) {
                const termList = t.terms?.length
                    ? t.terms.map((term) => `${term.name} (\`${term.slug}\`)`).join(', ')
                    : 'No terms discovered yet';
                out += `- **${t.name}** (\`${t.slug}\`): ${termList}\n`;
            }
        }
        if (ct.layoutBlueprint) {
            const bp = ct.layoutBlueprint;
            out += `\n### Detected Layout Blueprint\n`;
            out += `- **Sample Found:** ${bp.hasSamplePost ? 'Yes' : 'No (no published posts yet)'}\n`;
            out += `- **Featured Cover Image:** ${bp.hasFeaturedImage ? 'Yes' : 'No'} | **Inline Images:** ${bp.inlineImageCount ?? 0}\n`;
            if (bp.sampleHeadings?.length) {
                out += `- **Typical Headings:** ${bp.sampleHeadings.join(' | ')}\n`;
            }
            if (bp.sampleMetaKeys?.length) {
                out += `- **Meta Keys:** ${bp.sampleMetaKeys.join(', ')}\n`;
            }
            if (bp.sampleAcfExample) {
                out += `\n#### Example ACF Values\n\`\`\`json\n${JSON.stringify(bp.sampleAcfExample, null, 2)}\n\`\`\`\n`;
            }
            if (bp.sampleHtmlSnippet) {
                out += `\n#### Clean HTML Structure Sample\n\`\`\`html\n${bp.sampleHtmlSnippet}\n\`\`\`\n`;
            }
        }
        if (ct.acfFields && ct.acfFields.length > 0) {
            out += `\n### ACF / Custom Fields Schema\n\`\`\`json\n${JSON.stringify(ct.acfFields, null, 2)}\n\`\`\`\n`;
        }
        else if (!ct.layoutBlueprint?.sampleAcfExample) {
            out += `\n> No ACF custom fields detected for this content type.\n`;
        }
        return out;
    }
    const data = await client.get(`/websites/${args.websiteId}/content-types`);
    const types = Array.isArray(data) ? data : data.data ?? [];
    if (!Array.isArray(types) || types.length === 0) {
        return 'No content types found for this site. Make sure the site was scanned after adding.';
    }
    const rows = types.map((ct, i) => `${i + 1}. **${ct.name}** — slug: \`${ct.slug}\`` +
        `${ct.taxonomies?.length ? ` (Taxonomies: ${ct.taxonomies.join(', ')})` : ''}` +
        `${ct.description ? `\n   ${ct.description}` : ''}`);
    return `## Content Types for Site\n\n${rows.join('\n\n')}\n\n> Pass \`slug\` to \`get_content_types\` to inspect ACF fields, or use \`slug\` as \`contentTypeSlug\` in \`send_article_to_backend\` / \`list_wp_content\`.`;
}
