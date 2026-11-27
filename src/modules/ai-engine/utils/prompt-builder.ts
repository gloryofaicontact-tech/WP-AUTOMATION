import { ArticleParsingContext } from '../interfaces/parsed-article.interface';

export class PromptBuilder {
  static buildSystemPrompt(context: ArticleParsingContext): string {
    const categoriesList = context.availableCategories?.map((c) => `${c.name} (${c.slug})`).join(', ') || 'None provided';
    const tagsList = context.availableTags?.map((t) => `${t.name} (${t.slug})`).join(', ') || 'None provided';
    const acfFieldsList = context.acfFields?.length ? context.acfFields.join(', ') : 'None';
    const blueprint = context.layoutBlueprint;

    // Build dynamic image placeholder rules from real WordPress post-type inspection (zero hardcodes)
    let imageRuleText: string;
    if (blueprint?.hasSamplePost) {
      const parts: string[] = [];
      if (blueprint.hasFeaturedImage) {
        parts.push(
          blueprint.featuredImageRenderedInTemplate === false
            ? '1 featured cover image (`position: "featured_hero"` — NOTE: live template does not display featured_media visually, so the backend will also place it inside contentHtml)'
            : '1 featured cover image (`position: "featured_hero"`)',
        );
      }
      if (blueprint.inlineImageCount > 0) {
        parts.push(
          `${blueprint.inlineImageCount} inline image(s) inside content (e.g. "after_h2_1", "after_h2_2", "content_middle")`,
        );
      } else {
        parts.push('NO extra inline images beyond the hero image');
      }
      if (blueprint.acfImageFields?.length) {
        parts.push(`ACF image fields detected: [${blueprint.acfImageFields.join(', ')}]`);
      }
      imageRuleText =
        `   - Match the exact image layout detected on live "${context.contentTypeName}" posts: ${parts.join(' + ')}.`;
    } else {
      const hasThumb = Boolean(context.supportedFeatures?.includes('thumbnail'));
      imageRuleText =
        `   - No live sample posts exist yet for "${context.contentTypeName}". Determine placeholders strictly from post-type capabilities & article structure:\n` +
        `     * Featured image supported (thumbnail=${hasThumb}): ${hasThumb ? 'include 1 "featured_hero" placeholder' : 'omit "featured_hero" unless needed'}.\n` +
        `     * Only add inline placeholders ("after_h2_1", etc.) if the content is long-form editorial that naturally requires visual breaks.`;
    }

    // Build optional real-post reference template block
    let referenceSection = '';
    if (
      blueprint &&
      (blueprint.sampleHeadings?.length ||
        blueprint.sampleHtmlSnippet ||
        blueprint.sampleAcfExample ||
        blueprint.sampleMetaKeys?.length)
    ) {
      referenceSection = `\nREFERENCE LAYOUT FROM LIVE "${context.contentTypeName}" POST (Mirror this structure & tone):`;
      if (blueprint.sampleHeadings?.length) {
        referenceSection += `\n- Typical Section Headings: ${blueprint.sampleHeadings.join(' | ')}`;
      }
      if (blueprint.sampleAcfExample) {
        referenceSection += `\n- Example ACF Custom Fields: ${JSON.stringify(blueprint.sampleAcfExample).slice(0, 800)}`;
      }
      if (blueprint.sampleMetaKeys?.length) {
        referenceSection += `\n- Detected Post Meta Keys: ${blueprint.sampleMetaKeys.join(', ')}`;
      }
      if (blueprint.sampleHtmlSnippet) {
        referenceSection += `\n- Clean HTML Structure Sample:\n${blueprint.sampleHtmlSnippet}`;
      }
      referenceSection += '\n';
    }

    return `You are an elite WordPress editorial architect, SEO strategist, and visual art director.
Your mission is to analyze a raw, unformatted article draft and transform it into a publication-ready WordPress post.

TARGET WEBSITE CONTEXT:
- Site: ${context.websiteName || 'WordPress Site'} (${context.websiteUrl || ''})
- Target Post Type: "${context.contentTypeName}" (slug: "${context.contentTypeSlug}")
- Available WordPress Categories: [${categoriesList}]
- Available WordPress Tags: [${tagsList}]
- Target Custom Fields (ACF): [${acfFieldsList}]${referenceSection}

EXTRACTION & FORMATTING RULES:
1. Title: Create an engaging, punchy, high-CTR headline (preserve original intent).
2. Slug: Clean, URL-friendly permalink without stop words.
3. Target Focus Keyword: Identify the primary high-intent search query.
4. Meta Description: 140-160 characters, compelling summary that drives click-throughs.
5. Content HTML:
   - If a "Clean HTML Structure Sample" is provided above with theme classes (class="..."), inline styles (style="..."), wrapper <div> grids, summary boxes, or WordPress block comments, PRESERVE that exact HTML structure, classes, and styles — replacing only the text content for the new article.
   - Otherwise, convert section headers into <h2> and <h3>, wrap paragraphs in <p>, and convert lists into <ul><li> or <ol><li>.
   - Bold key takeaways using <strong>.
   - DO NOT output markdown blocks inside contentHtml (use raw HTML only).
   - DO NOT add fake citations or alter factual product/technical specifications.
6. Image Placeholders & Stock Photo Search Strategy:
${imageRuleText}
   - For each placeholder:
     * recommendedSearch: MUST be 2 to 3 concise, generic, high-volume stock photography keywords (e.g. "motor oil", "car engine", "mechanic garage", "travel passport"). NEVER output long sentences, commas, or brand-specific obscure terms (e.g. do NOT write "Liqui Moly factory production", write "motor oil" or "car engine").
     * fallbackSearch: An alternative 2-word broad stock query (e.g. "car repair", "auto workshop").
     * altText: SEO-rich, descriptive alt text (8-14 words).
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
      "recommendedSearch": "motor oil",
      "fallbackSearch": "car engine",
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
