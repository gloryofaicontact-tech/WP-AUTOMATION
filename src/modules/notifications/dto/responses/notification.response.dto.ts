import { Expose } from 'class-transformer';
import { NotificationType } from '@prisma/client';

export class NotificationResponseDto {
  @Expose()
  id!: string;

  @Expose()
  type!: NotificationType;

  @Expose()
  title!: string;

  @Expose()
  message!: string;

  @Expose()
  isRead!: boolean;

  @Expose()
  createdAt!: Date;
}
