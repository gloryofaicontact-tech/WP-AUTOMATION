import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { encryptText, decryptText } from '../../../common/utils/encryption.util';
import { UpdateAiSettingsDto } from '../dto/update-ai-settings.dto';
import { TestAiKeyDto } from '../dto/test-ai-key.dto';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private maskKey(key?: string | null): string | null {
    if (!key) return null;
    const clean = key.trim();
    if (clean.length <= 8) return '****';
    return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
  }

  /**
   * Retrieves active AI settings, masked keys, and configured models.
   */
  async getSettings() {
    const setting = await this.prisma.aiSetting.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const envAnthropic = this.config.get<string>('ANTHROPIC_API_KEY')?.trim();
    const envGemini = this.config.get<string>('GEMINI_API_KEY')?.trim();
    const envOpenAi = this.config.get<string>('OPENAI_API_KEY')?.trim();
    const envEnvato = this.config.get<string>('ENVATO_API_TOKEN')?.trim();

    const storedAnthropic = setting?.anthropicApiKey ? decryptText(setting.anthropicApiKey) : null;
    const storedGemini = setting?.geminiApiKey ? decryptText(setting.geminiApiKey) : null;
    const storedOpenAi = setting?.openAiApiKey ? decryptText(setting.openAiApiKey) : null;
    const storedEnvato = setting?.envatoApiToken ? decryptText(setting.envatoApiToken) : null;

    const effectiveAnthropic = storedAnthropic || envAnthropic;
    const effectiveGemini = storedGemini || envGemini;
    const effectiveOpenAi = storedOpenAi || envOpenAi;
    const effectiveEnvato = storedEnvato || envEnvato;

    const models = (setting?.models as Record<string, string>) || {};

    return {
      activeProvider: setting?.activeProvider || this.config.get<string>('AI_PROVIDER', 'claude'),
      providers: {
        claude: {
          isConfigured: Boolean(effectiveAnthropic),
          maskedKey: this.maskKey(effectiveAnthropic),
          model: models.claude || this.config.get<string>('ANTHROPIC_MODEL', 'claude-3-5-sonnet-latest'),
          source: storedAnthropic ? 'database' : envAnthropic ? 'env' : 'unconfigured',
        },
        gemini: {
          isConfigured: Boolean(effectiveGemini),
          maskedKey: this.maskKey(effectiveGemini),
          model: models.gemini || this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash'),
          source: storedGemini ? 'database' : envGemini ? 'env' : 'unconfigured',
        },
        openai: {
          isConfigured: Boolean(effectiveOpenAi),
          maskedKey: this.maskKey(effectiveOpenAi),
          model: models.openai || this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini'),
          source: storedOpenAi ? 'database' : envOpenAi ? 'env' : 'unconfigured',
        },
      },
      envato: {
        isConfigured: Boolean(effectiveEnvato),
        maskedToken: this.maskKey(effectiveEnvato),
        source: storedEnvato ? 'database' : envEnvato ? 'env' : 'unconfigured',
      },
      updatedAt: setting?.updatedAt || null,
    };
  }

  /**
   * Returns decrypted effective keys for runtime use.
   */
  async getEffectiveKeys() {
    const setting = await this.prisma.aiSetting.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const anthropicKey = (setting?.anthropicApiKey ? decryptText(setting.anthropicApiKey) : null) ||
      this.config.get<string>('ANTHROPIC_API_KEY')?.trim() || null;

    const geminiKey = (setting?.geminiApiKey ? decryptText(setting.geminiApiKey) : null) ||
      this.config.get<string>('GEMINI_API_KEY')?.trim() || null;

    const openAiKey = (setting?.openAiApiKey ? decryptText(setting.openAiApiKey) : null) ||
      this.config.get<string>('OPENAI_API_KEY')?.trim() || null;

    const envatoToken = (setting?.envatoApiToken ? decryptText(setting.envatoApiToken) : null) ||
      this.config.get<string>('ENVATO_API_TOKEN')?.trim() || null;

    const activeProvider = setting?.activeProvider || this.config.get<string>('AI_PROVIDER', 'claude');
    const models = (setting?.models as Record<string, string>) || {};

    return {
      activeProvider,
      anthropicKey,
      geminiKey,
      openAiKey,
      envatoToken,
      models,
    };
  }

  /**
   * Updates AI settings and encrypts keys.
   */
  async updateSettings(dto: UpdateAiSettingsDto, userId?: string) {
    const existing = await this.prisma.aiSetting.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const data: any = {};
    if (dto.activeProvider) data.activeProvider = dto.activeProvider.toLowerCase();
    if (dto.anthropicApiKey) data.anthropicApiKey = encryptText(dto.anthropicApiKey.trim());
    if (dto.geminiApiKey) data.geminiApiKey = encryptText(dto.geminiApiKey.trim());
    if (dto.openAiApiKey) data.openAiApiKey = encryptText(dto.openAiApiKey.trim());
    if (dto.envatoApiToken) data.envatoApiToken = encryptText(dto.envatoApiToken.trim());
    if (dto.models) data.models = dto.models;
    if (userId) data.updatedById = userId;

    let saved;
    if (existing) {
      saved = await this.prisma.aiSetting.update({
        where: { id: existing.id },
        data,
      });
    } else {
      saved = await this.prisma.aiSetting.create({
        data: {
          activeProvider: dto.activeProvider || 'claude',
          ...data,
        },
      });
    }

    this.logger.log(`AI settings updated (Active Provider: "${saved.activeProvider}")`);
    return this.getSettings();
  }

  /**
   * Health-checks an AI provider key by sending a minimal 1-token test prompt.
   */
  async testKey(dto: TestAiKeyDto) {
    const provider = dto.provider.toLowerCase();
    const effective = await this.getEffectiveKeys();

    const keyToTest =
      dto.apiKey?.trim() ||
      (provider === 'claude'
        ? effective.anthropicKey
        : provider === 'gemini'
        ? effective.geminiKey
        : provider === 'openai'
        ? effective.openAiKey
        : effective.envatoToken);

    if (!keyToTest) {
      throw new BadRequestException(`No API key provided or saved for provider "${provider}"`);
    }

    const startTime = Date.now();

    try {
      if (provider === 'claude') {
        const client = new Anthropic({ apiKey: keyToTest });
        const res = await client.messages.create({
          model: effective.models?.claude || 'claude-3-5-sonnet-latest',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Reply with the word OK' }],
        });
        const latencyMs = Date.now() - startTime;
        return {
          success: true,
          provider: 'claude',
          latencyMs,
          message: 'Anthropic Claude API connection verified successfully!',
          responseSnippet: res.content[0]?.type === 'text' ? res.content[0].text : 'OK',
        };
      }

      if (provider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: keyToTest });
        const model = effective.models?.gemini || 'gemini-2.5-flash';
        const res = await ai.models.generateContent({
          model,
          contents: 'Reply with the word OK',
        });
        const latencyMs = Date.now() - startTime;
        return {
          success: true,
          provider: 'gemini',
          latencyMs,
          message: 'Google Gemini API connection verified successfully!',
          responseSnippet: res.text?.trim() || 'OK',
        };
      }

      if (provider === 'openai') {
        const client = new OpenAI({ apiKey: keyToTest });
        const model = effective.models?.openai || 'gpt-4o-mini';
        const res = await client.chat.completions.create({
          model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Reply with the word OK' }],
        });
        const latencyMs = Date.now() - startTime;
        return {
          success: true,
          provider: 'openai',
          latencyMs,
          message: 'OpenAI ChatGPT API connection verified successfully!',
          responseSnippet: res.choices[0]?.message?.content?.trim() || 'OK',
        };
      }

      if (provider === 'envato') {
        const res = await fetch(
          'https://api.envato.com/v1/discovery/search/search/item?term=car&page_size=1',
          {
            headers: {
              Authorization: `Bearer ${keyToTest}`,
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(8000),
          },
        );
        const latencyMs = Date.now() - startTime;
        if (!res.ok) {
          throw new Error(`Envato returned HTTP ${res.status} ${res.statusText}`);
        }
        return {
          success: true,
          provider: 'envato',
          latencyMs,
          message: 'Envato Elements API connection verified successfully!',
        };
      }

      throw new BadRequestException(`Unsupported provider "${provider}"`);
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      this.logger.warn(`AI key test failed for "${provider}": ${err.message}`);
      return {
        success: false,
        provider,
        latencyMs,
        error: err.message,
      };
    }
  }
}
