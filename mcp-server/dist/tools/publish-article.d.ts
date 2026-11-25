import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';
export declare const publishArticleTool: Tool;
export declare function publishArticle(client: BackendClient, args: {
    websiteId: string;
    articleId: string;
    action: 'publish' | 'unpublish' | 'delete' | 'delete_permanent';
    allowPreviewImages?: boolean;
}): Promise<string>;
