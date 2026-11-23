import { Expose, Transform } from 'class-transformer';
import { NotificationType } from '@prisma/client';

export class NotificationResponseDto {
    @Expose()
    @Transform(({ value }) => value.toString(), { toPlainOnly: true })
    id!: string;

    @Expose()
    uuid!: string;

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