import { IsEnum, IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class CreateNotificationRequestDto {
    @IsNotEmpty()
    userId!: bigint;

    @IsEnum(NotificationType)
    type!: NotificationType;

    @IsString()
    @IsNotEmpty()
    title!: string;

    @IsString()
    @IsNotEmpty()
    message!: string;

    @IsOptional()
    @IsObject()
    data?: any;
}