import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AiProvider } from '../interfaces/ai-provider.interface';
import { ParsedArticleResult, ArticleParsingContext } from '../interfaces/parsed-article.interface';
import { PromptBuilder } from '../utils/prompt-builder';

@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly providerName = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);
  private client: OpenAI | null = null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    this.model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');

    if (apiKey) {
      this.client = new OpenAI({ apiKey });
      this.logger.log(`OpenAiProvider initialized with model: ${this.model}`);
    } else {
      this.logger.debug('OPENAI_API_KEY not set. OpenAiProvider will be unavailable.');
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
      throw new Error('OpenAiProvider is unavailable: OPENAI_API_KEY is not configured.');
    }

    const systemPrompt = PromptBuilder.buildSystemPrompt(context);
    const userPrompt = PromptBuilder.buildUserPrompt(rawDocument);

    this.logger.debug(`Sending document to OpenAI (${this.model})...`);

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content || '{}';
    return this.parseJsonResponse(content);
  }

  private parseJsonResponse(text: string): ParsedArticleResult {
    try {
      return JSON.parse(text.trim());
    } catch (err: any) {
      this.logger.error(`Failed to parse OpenAI JSON response: ${err.message}`);
      throw new Error(`OpenAI returned non-JSON output: ${text.substring(0, 200)}...`);
    }
  }
}
