import { WebsiteStatus } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class WebsiteResponseDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  url!: string;

  @Expose()
  restApiUrl!: string | null;

  @Expose()
  username!: string;

  @Expose()
  status!: WebsiteStatus;

  @Expose()
  lastError!: string | null;

  @Expose()
  lastSyncAt!: Date | null;

  @Expose()
  isActive!: boolean;

  @Expose()
  createdById!: string | null;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
