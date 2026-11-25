import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';
export declare const getContentTypesTool: Tool;
export declare function getContentTypes(client: BackendClient, args: {
    websiteId: string;
}): Promise<string>;
