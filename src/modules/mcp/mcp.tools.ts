import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const MCP_TOOLS: Tool[] = [
  {
    name: 'list_my_websites',
    description:
      'Returns all WordPress websites registered in WP-Automation. Use this first to get the websiteId needed for other tools.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_content_types',
    description:
      'Lists all available content types (post types) for a WordPress site — e.g. post, tour-package, destination. Pass an optional slug to also inspect its ACF custom fields, taxonomies, terms, and detected layoutBlueprint.',
    inputSchema: {
      type: 'object',
      properties: {
        websiteId: { type: 'string', description: 'The website UUID from list_my_websites' },
        slug: {
          type: 'string',
          description: 'Optional content type slug (e.g. "tour-package", "destination") to inspect full schema & layout.',
        },
      },
      required: ['websiteId'],
    },
  },
  {
    name: 'list_articles',
    description:
      'List all backend-managed articles (drafts and published) for a WordPress site.',
    inputSchema: {
      type: 'object',
      properties: {
        websiteId: { type: 'string', description: 'The website UUID from list_my_websites' },
        status: { type: 'string', description: 'Optional workflow status filter (e.g. "IMPORTED", "PUBLISHED")' },
        page: { type: 'number', default: 1 },
        limit: { type: 'number', default: 20 },
      },
      required: ['websiteId'],
    },
  },
  {
    name: 'get_article',
    description:
      'Fetch full details of a backend-managed article/draft by articleId, including HTML content, SEO metadata, custom fields, and image placeholders.',
    inputSchema: {
      type: 'object',
      properties: {
        websiteId: { type: 'string', description: 'The website UUID' },
        articleId: { type: 'string', description: 'The article UUID' },
      },
      required: ['websiteId', 'articleId'],
    },
  },
  {
    name: 'update_article',
    description:
      'Update an existing backend draft/article (title, slug, focusKeyword, metaDescription, contentHtml, customFields, categorySlugs, tagSlugs) without recreating it.',
    inputSchema: {
      type: 'object',
      properties: {
        websiteId: { type: 'string' },
        articleId: { type: 'string' },
        title: { type: 'string' },
        slug: { type: 'string' },
        focusKeyword: { type: 'string' },
        metaDescription: { type: 'string' },
        contentHtml: { type: 'string' },
        categorySlugs: { type: 'array', items: { type: 'string' } },
        tagSlugs: { type: 'array', items: { type: 'string' } },
        customFields: { type: 'object' },
      },
      required: ['websiteId', 'articleId'],
    },
  },
  {
    name: 'send_article_to_backend',
    description:
      'Send an article to WP-Automation to discover Envato images and save a WordPress draft. ' +
      'PREFERRED (Structured Mode): Pass `title` + `contentHtml` (+ optional `slug`, `focusKeyword`, `metaDescription`, `customFields`, `imagePlaceholders`) to preserve your exact layout and skip redundant backend AI parsing. ' +
      'FALLBACK (Raw Mode): Pass `rawContent` to let the backend AI parse plain text.',
    inputSchema: {
      type: 'object',
      properties: {
        websiteId: { type: 'string' },
        contentTypeSlug: { type: 'string' },
        title: { type: 'string' },
        contentHtml: { type: 'string' },
        slug: { type: 'string' },
        focusKeyword: { type: 'string' },
        metaDescription: { type: 'string' },
        categorySlugs: { type: 'array', items: { type: 'string' } },
        tagSlugs: { type: 'array', items: { type: 'string' } },
        customFields: { type: 'object' },
        imagePlaceholders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              position: { type: 'string' },
              recommendedSearch: { type: 'string' },
              fallbackSearch: { type: 'string' },
              altText: { type: 'string' },
              targetHeading: { type: 'string' },
            },
            required: ['recommendedSearch'],
          },
        },
        rawContent: { type: 'string' },
        autoPublish: { type: 'boolean', default: false },
        allowPreviewImages: { type: 'boolean', default: false },
      },
      required: ['websiteId', 'contentTypeSlug'],
    },
  },
  {
    name: 'publish_article',
    description: 'Publish, unpublish (revert to draft), or delete a backend article by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        websiteId: { type: 'string' },
        articleId: { type: 'string' },
        action: { type: 'string', enum: ['publish', 'unpublish', 'delete', 'delete_permanent'] },
        allowPreviewImages: { type: 'boolean', default: false },
      },
      required: ['websiteId', 'articleId', 'action'],
    },
  },
  {
    name: 'list_wp_content',
    description:
      'Search and list LIVE content directly from WordPress (including posts/pages created outside the backend).',
    inputSchema: {
      type: 'object',
      properties: {
        websiteId: { type: 'string' },
        contentTypeSlug: { type: 'string' },
        search: { type: 'string' },
        status: { type: 'string' },
        page: { type: 'number', default: 1 },
        limit: { type: 'number', default: 10 },
      },
      required: ['websiteId', 'contentTypeSlug'],
    },
  },
  {
    name: 'get_wp_content_item',
    description:
      'Fetch the full live WordPress post/package/destination by its WordPress Post ID (wpPostId), including HTML content, ACF custom fields, and featured image.',
    inputSchema: {
      type: 'object',
      properties: {
        websiteId: { type: 'string' },
        contentTypeSlug: { type: 'string' },
        wpPostId: { type: 'number' },
      },
      required: ['websiteId', 'contentTypeSlug', 'wpPostId'],
    },
  },
];
