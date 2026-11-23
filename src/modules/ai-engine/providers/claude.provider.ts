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
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY')?.trim();
    this.model = this.config.get<string>('ANTHROPIC_MODEL', 'claude-3-5-sonnet-latest');

    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log(`ClaudeProvider initialized with model: ${this.model}`);
    } else {
      this.logger.debug('ANTHROPIC_API_KEY not set. ClaudeProvider will be unavailable.');
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async parseAndStructureDocument(
    rawDocument: string,
    context: ArticleParsingContext,
  ): Promise<ParsedArticleResult> {
    if (!this.client) {
      throw new Error('ClaudeProvider is unavailable: ANTHROPIC_API_KEY is not configured.');
    }

    const systemPrompt = PromptBuilder.buildSystemPrompt(context);
    const userPrompt = PromptBuilder.buildUserPrompt(rawDocument);

    this.logger.debug(`Sending document to Claude (${this.model})...`);

    const response = await this.client.messages.create({
      model: this.model,
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
