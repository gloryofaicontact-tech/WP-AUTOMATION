import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../../test/test-helpers';
import { createMockNotification, resetNotificationIdCounter } from '../../test/mock-factories';
import { NotificationType } from '@prisma/client';

describe('NotificationsService', () => {
    let service: NotificationsService;
    let prisma: MockPrismaService;

    beforeEach(async () => {
        resetNotificationIdCounter();
        prisma = createMockPrismaService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationsService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<NotificationsService>(NotificationsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        const createDto = {
            userId: 1n,
            type: NotificationType.SYSTEM,
            title: 'Test Notification',
            message: 'This is a test notification',
            data: { key: 'value' },
        };

        it('should create a notification', async () => {
            const mockNotification = createMockNotification(createDto);
            prisma.notification.create.mockResolvedValue(mockNotification);

            const result = await service.create(createDto);

            expect(result).toEqual(mockNotification);
            expect(prisma.notification.create).toHaveBeenCalledWith({
                data: {
                    userId: createDto.userId,
                    type: createDto.type,
                    title: createDto.title,
                    message: createDto.message,
                    data: createDto.data,
                    isRead: false,
                },
            });
        });

        it('should handle null data', async () => {
            const dtoWithoutData = { ...createDto, data: undefined };
            prisma.notification.create.mockResolvedValue(createMockNotification());

            await service.create(dtoWithoutData);

            expect(prisma.notification.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    data: undefined,
                }),
            });
        });
    });

    describe('findAll', () => {
        const userId = 1n;
        const paginationDto = { page: 1, limit: 10 };

        it('should return paginated notifications with unread count', async () => {
            const mockNotifications = [
                createMockNotification({ userId }),
                createMockNotification({ userId }),
            ];

            // Mock the paginate function behavior
            prisma.notification.findMany = jest.fn().mockResolvedValue(mockNotifications);
            prisma.notification.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

            const result = await service.findAll(userId, paginationDto);

            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('meta');
        });
    });

    describe('markAsRead', () => {
        const userId = 1n;
        const notificationId = '1';

        it('should mark notification as read', async () => {
            const mockNotification = createMockNotification({ id: BigInt(notificationId), userId });
            prisma.notification.findFirst.mockResolvedValue(mockNotification);
            prisma.notification.update.mockResolvedValue({ ...mockNotification, isRead: true });

            const result = await service.markAsRead(notificationId, userId);

            expect(result).toEqual({ message: 'Notification marked as read' });
            expect(prisma.notification.update).toHaveBeenCalledWith({
                where: { id: BigInt(notificationId) },
                data: { isRead: true },
            });
        });

        it('should throw NotFoundException when notification not found', async () => {
            prisma.notification.findFirst.mockResolvedValue(null);

            await expect(service.markAsRead(notificationId, userId))
                .rejects.toThrow(NotFoundException);
            await expect(service.markAsRead(notificationId, userId))
                .rejects.toThrow('Notification not found');
        });

        it('should throw NotFoundException when notification belongs to different user', async () => {
            prisma.notification.findFirst.mockResolvedValue(null);

            await expect(service.markAsRead(notificationId, 2n))
                .rejects.toThrow(NotFoundException);
        });
    });

    describe('markAllAsRead', () => {
        const userId = 1n;

        it('should mark all notifications as read', async () => {
            prisma.notification.updateMany.mockResolvedValue({ count: 5 });

            const result = await service.markAllAsRead(userId);

            expect(result).toEqual({ message: 'All notifications marked as read' });
            expect(prisma.notification.updateMany).toHaveBeenCalledWith({
                where: { userId, isRead: false },
                data: { isRead: true },
            });
        });

        it('should succeed even when no notifications to update', async () => {
            prisma.notification.updateMany.mockResolvedValue({ count: 0 });

            const result = await service.markAllAsRead(userId);

            expect(result).toEqual({ message: 'All notifications marked as read' });
        });
    });

    describe('remove', () => {
        const userId = 1n;
        const notificationId = '1';

        it('should soft delete notification', async () => {
            const mockNotification = createMockNotification({ id: BigInt(notificationId), userId });
            prisma.notification.findFirst.mockResolvedValue(mockNotification);
            prisma.notification.update.mockResolvedValue({ ...mockNotification, deletedAt: new Date() });

            const result = await service.remove(notificationId, userId);

            expect(result).toEqual({ message: 'Notification deleted successfully' });
            expect(prisma.notification.update).toHaveBeenCalledWith({
                where: { id: BigInt(notificationId) },
                data: { deletedAt: expect.any(Date) },
            });
        });

        it('should throw NotFoundException when notification not found', async () => {
            prisma.notification.findFirst.mockResolvedValue(null);

            await expect(service.remove(notificationId, userId))
                .rejects.toThrow(NotFoundException);
            await expect(service.remove(notificationId, userId))
                .rejects.toThrow('Notification not found');
        });
    });
});
