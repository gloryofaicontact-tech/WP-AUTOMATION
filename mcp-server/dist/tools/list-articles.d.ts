import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';
export declare const listArticlesTool: Tool;
export declare function listArticles(client: BackendClient, args: {
    websiteId: string;
    status?: string;
    page?: number;
    limit?: number;
}): Promise<string>;
