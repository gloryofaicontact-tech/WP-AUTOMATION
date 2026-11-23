import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AiProvider } from '../interfaces/ai-provider.interface';
import { ParsedArticleResult, ArticleParsingContext } from '../interfaces/parsed-article.interface';
import { PromptBuilder } from '../utils/prompt-builder';

@Injectable()
export class GeminiProvider implements AiProvider {
  readonly providerName = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private client: GoogleGenAI | null = null;
  private readonly defaultModel: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    this.defaultModel = this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');

    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
      this.logger.log(`GeminiProvider initialized with model: ${this.defaultModel}`);
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
    const activeClient = apiKey ? new GoogleGenAI({ apiKey }) : this.client;
    if (!activeClient) {
      throw new Error('GeminiProvider is unavailable: No Gemini API key provided or configured.');
    }

    const model = modelOverride || this.defaultModel;
    const systemPrompt = PromptBuilder.buildSystemPrompt(context);
    const userPrompt = PromptBuilder.buildUserPrompt(rawDocument);

    this.logger.debug(`Sending document to Gemini (${model})...`);

    const response = await activeClient.models.generateContent({
      model,
      contents: `${systemPrompt}\n\n${userPrompt}`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    return this.parseJsonResponse(responseText);
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
      this.logger.error(`Failed to parse Gemini JSON response: ${err.message}`);
      throw new Error(`Gemini returned non-JSON output: ${cleaned.substring(0, 200)}...`);
    }
  }
}
