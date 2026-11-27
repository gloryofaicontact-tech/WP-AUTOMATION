import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class PluginConnectDto {
  @IsString()
  @IsNotEmpty()
  connectToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  url!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  username!: string;

  @IsString()
  @IsNotEmpty()
  applicationPassword!: string;
}
