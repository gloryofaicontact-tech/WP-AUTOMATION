import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateWebsiteRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  url!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username!: string;

  @IsString()
  @IsNotEmpty()
  applicationPassword!: string;
}
