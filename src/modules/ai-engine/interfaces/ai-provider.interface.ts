import { ParsedArticleResult, ArticleParsingContext } from './parsed-article.interface';

export interface AiProvider {
  readonly providerName: string;
  isAvailable(apiKey?: string): boolean;
  parseAndStructureDocument(
    rawDocument: string,
    context: ArticleParsingContext,
    apiKey?: string,
    modelOverride?: string,
  ): Promise<ParsedArticleResult>;
}
