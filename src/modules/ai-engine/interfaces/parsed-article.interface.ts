import { ImagePlaceholder } from './image-placeholder.interface';

export interface ParsedArticleResult {
  title: string;
  slug: string;
  focusKeyword: string;
  metaDescription: string;
  contentHtml: string;
  imagePlaceholders: ImagePlaceholder[];
  categorySlugs: string[];
  tagSlugs: string[];
  customFields: Record<string, any>;
  summaryNotes?: string;
}

export interface ContentTypeLayoutBlueprint {
  hasSamplePost: boolean;
  hasFeaturedImage: boolean;
  inlineImageCount: number;
  sampleHeadings?: string[];
  sampleHtmlSnippet?: string;
  sampleAcfExample?: Record<string, any> | null;
  sampleMetaKeys?: string[];
}

export interface ArticleParsingContext {
  websiteName?: string;
  websiteUrl?: string;
  contentTypeSlug: string;
  contentTypeName: string;
  availableCategories?: Array<{ name: string; slug: string }>;
  availableTags?: Array<{ name: string; slug: string }>;
  supportedFeatures?: string[];
  acfFields?: string[];
  layoutBlueprint?: ContentTypeLayoutBlueprint | null;
}
