import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';
export declare const updateArticleTool: Tool;
export declare function updateArticle(client: BackendClient, args: {
    websiteId: string;
    articleId: string;
    title?: string;
    slug?: string;
    focusKeyword?: string;
    metaDescription?: string;
    contentHtml?: string;
    categorySlugs?: string[];
    tagSlugs?: string[];
    customFields?: Record<string, unknown>;
}): Promise<string>;
