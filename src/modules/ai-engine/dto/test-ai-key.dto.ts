import { IsIn, IsOptional, IsString } from 'class-validator';

export class TestAiKeyDto {
  @IsIn(['claude', 'gemini', 'openai', 'envato'])
  provider!: string;

  @IsString()
  @IsOptional()
  apiKey?: string;
}
