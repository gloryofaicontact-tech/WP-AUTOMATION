import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';

export class UpdateArticleDraftDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  focusKeyword?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;

  @IsString()
  @IsOptional()
  contentHtml?: string;

  @IsArray()
  @IsOptional()
  categorySlugs?: string[];

  @IsArray()
  @IsOptional()
  tagSlugs?: string[];

  @IsObject()
  @IsOptional()
  customFields?: Record<string, any>;

  @IsString()
  @IsOptional()
  featuredImageUrl?: string;
}
