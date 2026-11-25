import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';
export declare const sendArticleTool: Tool;
export declare function sendArticle(client: BackendClient, args: {
    websiteId: string;
    contentTypeSlug: string;
    rawContent: string;
    autoPublish?: boolean;
    allowPreviewImages?: boolean;
}): Promise<string>;
