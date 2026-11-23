import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { RuleBasedFallbackProvider } from './providers/fallback.provider';
import { AiEngineService } from './ai-engine.service';

@Module({
  imports: [ConfigModule],
  providers: [
    ClaudeProvider,
    GeminiProvider,
    OpenAiProvider,
    RuleBasedFallbackProvider,
    AiEngineService,
  ],
  exports: [AiEngineService],
})
export class AiEngineModule {}
