import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider } from './interfaces/ai-provider.interface';
import { ParsedArticleResult, ArticleParsingContext } from './interfaces/parsed-article.interface';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { RuleBasedFallbackProvider } from './providers/fallback.provider';
import { AiSettingsService } from './settings/ai-settings.service';

@Injectable()
export class AiEngineService {
  private readonly logger = new Logger(AiEngineService.name);
  private readonly providers: Map<string, AiProvider> = new Map();

  constructor(
    private readonly config: ConfigService,
    private readonly aiSettingsService: AiSettingsService,
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
   * Main entry point: Parses and structures a raw document into WordPress post format.
   * Dynamically checks database settings first, with automatic provider fallback resilience.
   */
  async parseArticle(
    rawDocument: string,
    context: ArticleParsingContext,
    preferredProviderOverride?: string,
  ): Promise<ParsedArticleResult> {
    const effective = await this.aiSettingsService.getEffectiveKeys();

    const configuredProvider =
      preferredProviderOverride ||
      effective.activeProvider ||
      this.config.get<string>('AI_PROVIDER', 'claude').toLowerCase().trim();

    const providerOrder = [
      configuredProvider,
      'claude',
      'gemini',
      'openai',
      'fallback',
    ];

    const executionChain = Array.from(new Set(providerOrder));

    for (const providerName of executionChain) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      let keyToUse: string | undefined;
      let modelOverride: string | undefined;

      if (providerName === 'claude') {
        keyToUse = effective.anthropicKey || undefined;
        modelOverride = effective.models?.claude;
      } else if (providerName === 'gemini') {
        keyToUse = effective.geminiKey || undefined;
        modelOverride = effective.models?.gemini;
      } else if (providerName === 'openai') {
        keyToUse = effective.openAiKey || undefined;
        modelOverride = effective.models?.openai;
      }

      if (!provider.isAvailable(keyToUse)) {
        continue;
      }

      try {
        this.logger.log(`Attempting document extraction using provider: "${providerName}"`);
        const result = await provider.parseAndStructureDocument(
          rawDocument,
          context,
          keyToUse,
          modelOverride,
        );
        this.logger.log(
          `Document successfully structured by "${providerName}" (Title: "${result.title}")`,
        );
        return result;
      } catch (err: any) {
        this.logger.warn(
          `Provider "${providerName}" failed: ${err.message}. Trying next available provider...`,
        );
      }
    }

    this.logger.warn('All external LLM providers failed or were unconfigured. Using RuleBasedFallbackProvider.');
    return this.fallbackProvider.parseAndStructureDocument(rawDocument, context);
  }
}
