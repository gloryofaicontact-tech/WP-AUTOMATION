import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BackendClient } from '../client.js';
export declare const sendArticleTool: Tool;
export interface SendArticleArgs {
    websiteId: string;
    contentTypeSlug: string;
    rawContent?: string;
    title?: string;
    contentHtml?: string;
    slug?: string;
    focusKeyword?: string;
    metaDescription?: string;
    categorySlugs?: string[];
    tagSlugs?: string[];
    customFields?: Record<string, unknown>;
    imagePlaceholders?: Array<{
        position?: string;
        recommendedSearch: string;
        fallbackSearch?: string;
        altText?: string;
        targetHeading?: string;
    }>;
    autoPublish?: boolean;
    allowPreviewImages?: boolean;
}
export declare function sendArticle(client: BackendClient, args: SendArticleArgs): Promise<string>;
