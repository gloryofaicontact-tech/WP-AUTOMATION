import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider } from './interfaces/ai-provider.interface';
import { ParsedArticleResult, ArticleParsingContext } from './interfaces/parsed-article.interface';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { RuleBasedFallbackProvider } from './providers/fallback.provider';

@Injectable()
export class AiEngineService {
  private readonly logger = new Logger(AiEngineService.name);
  private readonly providers: Map<string, AiProvider> = new Map();

  constructor(
    private readonly config: ConfigService,
    private readonly claudeProvider: ClaudeProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly openAiProvider: OpenAiProvider,
    private readonly fallbackProvider: RuleBasedFallbackProvider,
  ) {
    this.providers.set('claude', this.claudeProvider);
    this.providers.set('gemini', this.geminiProvider);
    this.providers.set('openai', this.openAiProvider);
    this.providers.set('fallback', this.fallbackProvider);
  }

  /**
   * Returns list of configured active providers
   */
  getAvailableProviders(): string[] {
    const list: string[] = [];
    for (const [name, provider] of this.providers.entries()) {
      if (provider.isAvailable()) {
        list.push(name);
      }
    }
    return list;
  }

  /**
   * Main entry point: Parses and structures a raw document into WordPress post format.
   * Dynamically routes to the preferred provider, with automatic fallback resilience.
   */
  async parseArticle(
    rawDocument: string,
    context: ArticleParsingContext,
    preferredProviderOverride?: string,
  ): Promise<ParsedArticleResult> {
    const configuredProvider =
      preferredProviderOverride ||
      this.config.get<string>('AI_PROVIDER', 'claude').toLowerCase().trim();

    const providerOrder = [
      configuredProvider,
      'claude',
      'gemini',
      'openai',
      'fallback',
    ];

    // Remove duplicates while keeping order
    const executionChain = Array.from(new Set(providerOrder));

    let lastError: any = null;

    for (const providerName of executionChain) {
      const provider = this.providers.get(providerName);
      if (!provider || !provider.isAvailable()) {
        continue;
      }

      try {
        this.logger.log(`Attempting document extraction using provider: "${providerName}"`);
        const result = await provider.parseAndStructureDocument(rawDocument, context);
        this.logger.log(
          `Document successfully structured by "${providerName}" (Title: "${result.title}", Headings/Placeholders: ${result.imagePlaceholders?.length || 0})`,
        );
        return result;
      } catch (err: any) {
        this.logger.warn(`Provider "${providerName}" failed: ${err.message}. Trying next available provider...`);
        lastError = err;
      }
    }

    // Final fallback to heuristic parser if everything else threw
    this.logger.warn('All external LLM providers failed or were unconfigured. Using RuleBasedFallbackProvider.');
    return this.fallbackProvider.parseAndStructureDocument(rawDocument, context);
  }
}
