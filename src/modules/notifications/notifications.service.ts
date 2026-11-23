import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateNotificationRequestDto } from './dto/requests/create-notification.request.dto';
import { NotificationResponseDto } from './dto/responses/notification.response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { plainToInstance } from 'class-transformer';
import { paginate } from '../../common/utils/pagination.util';
import type { Prisma } from '@prisma/client';

const NOTIFICATION_SELECT = {
  id: true,
  userId: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNotificationRequestDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        isRead: false,
      },
    });
  }

  async findAll(userId: string, paginationDto: PaginationDto) {
    const result = await paginate(
      this.prisma.notification,
      paginationDto,
      {
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: NOTIFICATION_SELECT,
      },
    );

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
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

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: true },
    });

    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { message: 'All notifications marked as read' };
  }

  async remove(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id: notification.id },
    });

    return { message: 'Notification deleted successfully' };
  }
}
