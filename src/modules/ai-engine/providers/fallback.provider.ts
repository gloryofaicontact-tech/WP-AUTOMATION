import { Injectable, Logger } from '@nestjs/common';
import { AiProvider } from '../interfaces/ai-provider.interface';
import { ParsedArticleResult, ArticleParsingContext } from '../interfaces/parsed-article.interface';
import { ImagePlaceholder } from '../interfaces/image-placeholder.interface';

/**
 * Intelligent regex and heuristic rule-based parser.
 * Runs instantly without an API key or network access as a zero-failure fallback.
 */
@Injectable()
export class RuleBasedFallbackProvider implements AiProvider {
  readonly providerName = 'fallback';
  private readonly logger = new Logger(RuleBasedFallbackProvider.name);

  isAvailable(): boolean {
    return true; // Always available
  }

  async parseAndStructureDocument(
    rawDocument: string,
    context: ArticleParsingContext,
  ): Promise<ParsedArticleResult> {
    this.logger.debug('Executing RuleBasedFallbackProvider parsing heuristics...');

    const lines = rawDocument
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let title = '';
    let focusKeyword = '';
    let metaDescription = '';
    const bodyLines: string[] = [];

    // Check for explicit metadata patterns:
    // e.g. "ARTICLE 1", "Target search term: ...", "Meta description: ..."
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (/^article\s+\d+/i.test(line)) {
        i++;
        continue;
      }

      if (/^target\s+(search\s+term|keyword):\s*(.*)/i.test(line)) {
        const match = line.match(/^target\s+(search\s+term|keyword):\s*(.*)/i);
        focusKeyword = match?.[2]?.trim() || '';
        i++;
        continue;
      }

      if (/^meta\s+description:\s*(.*)/i.test(line)) {
        const match = line.match(/^meta\s+description:\s*(.*)/i);
        metaDescription = match?.[1]?.trim() || '';
        i++;
        continue;
      }

      if (!title) {
        title = line;
        i++;
        continue;
      }

      bodyLines.push(line);
      i++;
    }

    if (!title) {
      title = 'Untitled Article';
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!metaDescription && bodyLines.length > 0) {
      metaDescription = bodyLines[0].substring(0, 155) + '...';
    }

    // Convert body lines into clean HTML
    const contentHtmlParts: string[] = [];
    let inList = false;
    const headingsFound: string[] = [];

    for (const bLine of bodyLines) {
      // Heading detection: short line ending with question mark or short phrase
      const isHeading =
        bLine.length < 70 &&
        !bLine.endsWith('.') &&
        (bLine.endsWith('?') || /^[A-Z0-9\s:–-]+$/.test(bLine) || /^(Who|What|Why|Which|When|How|The|Common)\b/i.test(bLine));

      const isBullet = /^[•\-*]\s*(.*)/.test(bLine);

      if (isBullet) {
        if (!inList) {
          contentHtmlParts.push('<ul>');
          inList = true;
        }
        const bulletText = bLine.replace(/^[•\-*]\s*/, '').trim();
        contentHtmlParts.push(`  <li>${bulletText}</li>`);
        continue;
      }

      if (inList) {
        contentHtmlParts.push('</ul>');
        inList = false;
      }

      if (isHeading) {
        contentHtmlParts.push(`<h2>${bLine}</h2>`);
        headingsFound.push(bLine);
      } else {
        contentHtmlParts.push(`<p>${bLine}</p>`);
      }
    }

    if (inList) {
      contentHtmlParts.push('</ul>');
    }

    const contentHtml = contentHtmlParts.join('\n');

    // Create recommended image placeholders
    const imagePlaceholders: ImagePlaceholder[] = [
      {
        placeholderId: 'hero_featured',
        position: 'featured_hero',
        recommendedSearch: title.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().split(' ').slice(0, 5).join(' '),
        altText: title,
        targetHeading: title,
      },
    ];

    if (headingsFound.length > 0) {
      imagePlaceholders.push({
        placeholderId: 'section_image_1',
        position: 'after_h2_1',
        recommendedSearch: headingsFound[0].replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().split(' ').slice(0, 5).join(' '),
        altText: headingsFound[0],
        targetHeading: headingsFound[0],
      });
    }

    // Match categories
    const categorySlugs: string[] = [];
    if (context.availableCategories?.length) {
      for (const cat of context.availableCategories) {
        if (title.toLowerCase().includes(cat.name.toLowerCase()) || rawDocument.toLowerCase().includes(cat.name.toLowerCase())) {
          categorySlugs.push(cat.slug);
        }
      }
      if (categorySlugs.length === 0) {
        categorySlugs.push(context.availableCategories[0].slug);
      }
    }

    return {
      title,
      slug,
      focusKeyword: focusKeyword || title.split(' ').slice(0, 3).join(' '),
      metaDescription,
      contentHtml,
      imagePlaceholders,
      categorySlugs,
      tagSlugs: [],
      customFields: {},
      summaryNotes: 'Parsed with intelligent heuristic fallback parser.',
    };
  }
}
