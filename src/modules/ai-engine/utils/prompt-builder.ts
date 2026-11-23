import { ArticleParsingContext } from '../interfaces/parsed-article.interface';

export class PromptBuilder {
  static buildSystemPrompt(context: ArticleParsingContext): string {
    const categoriesList = context.availableCategories?.map((c) => `${c.name} (${c.slug})`).join(', ') || 'None provided';
    const tagsList = context.availableTags?.map((t) => `${t.name} (${t.slug})`).join(', ') || 'None provided';
    const acfFieldsList = context.acfFields?.length ? context.acfFields.join(', ') : 'None';

    return `You are an elite WordPress editorial architect, SEO strategist, and visual art director.
Your mission is to analyze a raw, unformatted article draft and transform it into a publication-ready WordPress post.

TARGET WEBSITE CONTEXT:
- Site: ${context.websiteName || 'WordPress Site'} (${context.websiteUrl || ''})
- Target Post Type: "${context.contentTypeName}" (slug: "${context.contentTypeSlug}")
- Available WordPress Categories: [${categoriesList}]
- Available WordPress Tags: [${tagsList}]
- Target Custom Fields (ACF): [${acfFieldsList}]

EXTRACTION & FORMATTING RULES:
1. Title: Create an engaging, punchy, high-CTR headline (preserve original intent).
2. Slug: Clean, URL-friendly permalink without stop words.
3. Target Focus Keyword: Identify the primary high-intent search query.
4. Meta Description: 140-160 characters, compelling summary that drives click-throughs.
5. Content HTML:
   - Convert all section headers into proper <h2> and <h3> tags.
   - Wrap paragraphs cleanly in <p> tags.
   - Convert all lists into <ul><li> or <ol><li>.
   - Bold key takeaways using <strong>.
   - DO NOT output markdown blocks inside contentHtml (use raw HTML only).
   - DO NOT add fake citations or alter factual product/technical specifications.
6. Image Placeholders:
   - Identify 2 to 3 optimal visual positions in the layout:
     * One featured hero image (position: "featured_hero")
     * One or two in-content images (e.g. position: "after_h2_1", "after_h2_2", or "content_middle")
   - For each placeholder:
     * recommendedSearch: 3 to 6 descriptive stock search keywords (e.g. "liqui moly synthetic motor oil can garage") suitable for Envato / stock libraries.
     * altText: SEO-rich, descriptive alt text (10-15 words).
     * targetHeading: The heading or section this image illustrates.
7. Taxonomies:
   - Pick the closest matching category slugs from the available list.
   - Pick or generate 3-5 relevant tag slugs.
8. Custom Fields (ACF):
   - If custom fields are defined for this post type (e.g. price, duration, rating, itinerary), extract them into a key-value object.

You must respond ONLY with valid, parseable JSON matching this structure:
{
  "title": "string",
  "slug": "string",
  "focusKeyword": "string",
  "metaDescription": "string",
  "contentHtml": "<p>...</p><h2>...</h2><p>...</p>",
  "imagePlaceholders": [
    {
      "placeholderId": "hero_featured",
      "position": "featured_hero",
      "recommendedSearch": "string",
      "altText": "string",
      "targetHeading": "string"
    }
  ],
  "categorySlugs": ["slug1"],
  "tagSlugs": ["tag1", "tag2"],
  "customFields": {},
  "summaryNotes": "Brief 1-sentence editorial summary"
}`;
  }

  static buildUserPrompt(rawDocument: string): string {
    return `Analyze the following raw document and extract the publication-ready JSON according to your system instructions:\n\n---\n${rawDocument}\n---`;
  }
}
