import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { RuleBasedFallbackProvider } from './providers/fallback.provider';
import { AiSettingsService } from './settings/ai-settings.service';
import { AiSettingsController } from './settings/ai-settings.controller';
import { AiEngineService } from './ai-engine.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AiSettingsController],
  providers: [
    ClaudeProvider,
    GeminiProvider,
    OpenAiProvider,
    RuleBasedFallbackProvider,
    AiSettingsService,
    AiEngineService,
  ],
  exports: [AiEngineService, AiSettingsService],
})
export class AiEngineModule {}
