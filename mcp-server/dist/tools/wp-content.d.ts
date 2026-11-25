import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';
export declare const listWpContentTool: Tool;
export declare const getWpContentItemTool: Tool;
export declare function listWpContent(client: BackendClient, args: {
    websiteId: string;
    contentTypeSlug: string;
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
}): Promise<string>;
export declare function getWpContentItem(client: BackendClient, args: {
    websiteId: string;
    contentTypeSlug: string;
    wpPostId: number;
}): Promise<string>;
