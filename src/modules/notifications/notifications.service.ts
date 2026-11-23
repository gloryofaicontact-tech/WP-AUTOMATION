import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateNotificationRequestDto } from './dto/requests/create-notification.request.dto';
import { NotificationResponseDto } from './dto/responses/notification.response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { plainToInstance } from 'class-transformer';
import { paginate } from '../../common/utils/pagination.util';
import { Prisma } from '@prisma/client';
import { isUuid } from '../../common/utils/uuid.util';

const NOTIFICATION_SELECT = {
    id: true,
    uuid: true,
    type: true,
    title: true,
    message: true,
    data: true,
    isRead: true,
    createdAt: true,
} satisfies Prisma.NotificationSelect;

@Injectable()
export class NotificationsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateNotificationRequestDto) {
        return this.prisma.notification.create({
            data: {
                userId: dto.userId,
                type: dto.type,
                title: dto.title,
                message: dto.message,
                data: dto.data ?? undefined,
                isRead: false,
            },
        });
    }

    async findAll(userId: bigint, paginationDto: PaginationDto) {

        const result = await paginate(
            this.prisma.notification,
            paginationDto,
            {
                where: {
                    userId,
                    deletedAt: null
                },
                orderBy: { createdAt: 'desc' },
                select: NOTIFICATION_SELECT
            }
        );

        const unreadCount = await this.prisma.notification.count({
            where: { userId, isRead: false, deletedAt: null },
        });

        const mappedData = plainToInstance(NotificationResponseDto, result.data, {
            excludeExtraneousValues: true,
        });

        return {
            message: 'Notifications retrieved successfully',
            data: mappedData,
            meta: {
                ...result.meta,
                unreadCount,
            },
        };
    }

    /**
     * Mark as read by notification ID or UUID (user can only mark own notifications).
     */
    async markAsRead(idOrUuid: string, userId: bigint) {
        const where: { userId: bigint; id?: bigint; uuid?: string } = { userId };
        if (isUuid(idOrUuid)) where.uuid = idOrUuid;
        else if (/^\d+$/.test(idOrUuid)) where.id = BigInt(idOrUuid);
        else throw new NotFoundException('Notification not found');

        const notification = await this.prisma.notification.findFirst({
            where: { ...where, deletedAt: null },
            select: { id: true },
        });

        if (!notification) throw new NotFoundException('Notification not found');

        await this.prisma.notification.update({
            where: { id: notification.id },
            data: { isRead: true },
        });

        return { message: 'Notification marked as read' };
    }

    async markAllAsRead(userId: bigint) {
        await this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
        return { message: 'All notifications marked as read' };
    }

    /**
     * Remove (soft delete) by notification ID or UUID (user can only delete own notifications).
     */
    async remove(idOrUuid: string, userId: bigint) {
        const where: { userId: bigint; id?: bigint; uuid?: string } = { userId };
        if (isUuid(idOrUuid)) where.uuid = idOrUuid;
        else if (/^\d+$/.test(idOrUuid)) where.id = BigInt(idOrUuid);
        else throw new NotFoundException('Notification not found');

        const notification = await this.prisma.notification.findFirst({
            where: { ...where, deletedAt: null },
            select: { id: true },
        });

        if (!notification) throw new NotFoundException('Notification not found');

        await this.prisma.notification.update({
            where: { id: notification.id },
            data: { deletedAt: new Date() },
        });

        return { message: 'Notification deleted successfully' };
    }
}