#!/usr/bin/env node
// ============================================================
// WP-Automation MCP Server
// Compatible with: Claude Desktop, Claude.ai, any MCP client
// ============================================================
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from './client.js';
import { listWebsitesTool, listWebsites } from './tools/list-websites.js';
import { getContentTypesTool, getContentTypes } from './tools/get-content-types.js';
import { listArticlesTool, listArticles } from './tools/list-articles.js';
import { getArticleTool, getArticle } from './tools/get-article.js';
import { updateArticleTool, updateArticle } from './tools/update-article.js';
import { sendArticleTool, sendArticle, } from './tools/send-article.js';
import { publishArticleTool, publishArticle } from './tools/publish-article.js';
import { listWpContentTool, listWpContent, getWpContentItemTool, getWpContentItem, } from './tools/wp-content.js';
// ── Config from environment (set in claude_desktop_config.json) ──────────────
const BACKEND_URL = process.env.WP_BACKEND_URL ?? 'http://localhost:3000/api/v1';
const BACKEND_TOKEN = process.env.WP_BACKEND_TOKEN ?? '';
if (!BACKEND_TOKEN) {
    console.error('[WP-MCP] ⚠️  WP_BACKEND_TOKEN is not set. ' +
        'Set it in your MCP client config (env block). ' +
        'Get a token by calling POST /api/v1/auth/login on your backend.');
}
// ── Backend client (singleton) ───────────────────────────────────────────────
const client = new BackendClient({ baseUrl: BACKEND_URL, token: BACKEND_TOKEN });
// ── MCP server ───────────────────────────────────────────────────────────────
const server = new Server({
    name: 'wp-automation-mcp',
    version: '1.1.0',
}, {
    capabilities: {
        tools: {},
    },
});
// List all tools (8 tools)
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        listWebsitesTool,
        getContentTypesTool,
        listArticlesTool,
        getArticleTool,
        updateArticleTool,
        sendArticleTool,
        publishArticleTool,
        listWpContentTool,
        getWpContentItemTool,
    ],
}));
// Execute tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        let text;
        switch (name) {
            case 'list_my_websites':
                text = await listWebsites(client);
                break;
            case 'get_content_types':
                text = await getContentTypes(client, args);
                break;
            case 'list_articles':
                text = await listArticles(client, args);
                break;
            case 'get_article':
                text = await getArticle(client, args);
                break;
            case 'update_article':
                text = await updateArticle(client, args);
                break;
            case 'send_article_to_backend':
                text = await sendArticle(client, args);
                break;
            case 'publish_article':
                text = await publishArticle(client, args);
                break;
            case 'list_wp_content':
                text = await listWpContent(client, args);
                break;
            case 'get_wp_content_item':
                text = await getWpContentItem(client, args);
                break;
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
        return {
            content: [{ type: 'text', text }],
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: [
                {
                    type: 'text',
                    text: `## ❌ Error\n\n\`\`\`\n${message}\n\`\`\`\n\nIf this is a 401 error, your JWT token may have expired. Re-login to your backend and update \`WP_BACKEND_TOKEN\` in your MCP config.`,
                },
            ],
            isError: true,
        };
    }
});
// ── Start ─────────────────────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[WP-MCP] ✅ WP-Automation MCP server running (stdio transport)');
    console.error(`[WP-MCP] Backend: ${BACKEND_URL}`);
}
main().catch((err) => {
    console.error('[WP-MCP] Fatal error:', err);
    process.exit(1);
});
