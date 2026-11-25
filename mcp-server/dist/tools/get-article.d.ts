import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';
export declare const getArticleTool: Tool;
export declare function getArticle(client: BackendClient, args: {
    websiteId: string;
    articleId: string;
}): Promise<string>;
