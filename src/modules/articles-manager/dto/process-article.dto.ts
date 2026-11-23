import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class ProcessArticleRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contentTypeSlug!: string;

  @IsString()
  @IsNotEmpty()
  rawDocument!: string;

  @IsString()
  @IsOptional()
  preferredAiProvider?: string;
}
