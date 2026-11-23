import { ParsedArticleResult, ArticleParsingContext } from './parsed-article.interface';

export interface AiProvider {
  readonly providerName: string;
  isAvailable(): boolean;
  parseAndStructureDocument(
    rawDocument: string,
    context: ArticleParsingContext,
  ): Promise<ParsedArticleResult>;
}
