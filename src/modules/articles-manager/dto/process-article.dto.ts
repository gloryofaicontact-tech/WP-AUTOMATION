import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsObject,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImagePlaceholderInputDto {
  @IsString()
  @IsOptional()
  position?: 'featured_hero' | 'after_h2_1' | 'after_h2_2' | 'after_h2_3' | 'content_middle' | 'content_end';

  @IsString()
  @IsNotEmpty()
  recommendedSearch!: string;

  @IsString()
  @IsOptional()
  fallbackSearch?: string;

  @IsString()
  @IsOptional()
  altText?: string;

  @IsString()
  @IsOptional()
  targetHeading?: string;
}

export class ProcessArticleRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contentTypeSlug!: string;

  @IsString()
  @IsOptional()
  rawDocument?: string;

  @IsString()
  @IsOptional()
  preferredAiProvider?: string;

  // Optional pre-structured fields (used by MCP when AI client already formatted layout)
  @IsString()
  @IsOptional()
  @MaxLength(300)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  slug?: string;

  @IsString()
  @IsOptional()
  contentHtml?: string;

  @IsString()
  @IsOptional()
  focusKeyword?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categorySlugs?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagSlugs?: string[];

  @IsObject()
  @IsOptional()
  customFields?: Record<string, any>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImagePlaceholderInputDto)
  @IsOptional()
  imagePlaceholders?: ImagePlaceholderInputDto[];
}
