import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AiProvider } from '../interfaces/ai-provider.interface';
import { ParsedArticleResult, ArticleParsingContext } from '../interfaces/parsed-article.interface';
import { PromptBuilder } from '../utils/prompt-builder';

@Injectable()
export class ClaudeProvider implements AiProvider {
  readonly providerName = 'claude';
  private readonly logger = new Logger(ClaudeProvider.name);
  private client: Anthropic | null = null;
  private readonly defaultModel: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY')?.trim();
    this.defaultModel = this.config.get<string>('ANTHROPIC_MODEL', 'claude-3-5-sonnet-latest');

    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log(`ClaudeProvider initialized with model: ${this.defaultModel}`);
    }
  }

  isAvailable(apiKey?: string): boolean {
    return Boolean(apiKey || this.client);
  }

  async parseAndStructureDocument(
    rawDocument: string,
    context: ArticleParsingContext,
    apiKey?: string,
    modelOverride?: string,
  ): Promise<ParsedArticleResult> {
    const activeClient = apiKey ? new Anthropic({ apiKey }) : this.client;
    if (!activeClient) {
      throw new Error('ClaudeProvider is unavailable: No Anthropic API key provided or configured.');
    }

    const model = modelOverride || this.defaultModel;
    const systemPrompt = PromptBuilder.buildSystemPrompt(context);
    const userPrompt = PromptBuilder.buildUserPrompt(rawDocument);

    this.logger.debug(`Sending document to Claude (${model})...`);

    const response = await activeClient.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    return this.parseJsonResponse(textContent);
  }

  private parseJsonResponse(text: string): ParsedArticleResult {
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch (err: any) {
      this.logger.error(`Failed to parse Claude JSON response: ${err.message}`);
      throw new Error(`Claude returned non-JSON output: ${cleaned.substring(0, 200)}...`);
    }
  }
}
