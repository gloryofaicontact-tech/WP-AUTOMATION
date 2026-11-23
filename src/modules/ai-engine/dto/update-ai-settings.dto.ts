import { IsIn, IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateAiSettingsDto {
  @IsIn(['claude', 'gemini', 'openai'])
  @IsOptional()
  activeProvider?: string;

  @IsString()
  @IsOptional()
  anthropicApiKey?: string;

  @IsString()
  @IsOptional()
  geminiApiKey?: string;

  @IsString()
  @IsOptional()
  openAiApiKey?: string;

  @IsString()
  @IsOptional()
  envatoApiToken?: string;

  @IsObject()
  @IsOptional()
  models?: Record<string, string>;
}
