import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import {
    createMockPrismaService,
    createMockNotificationsService,
    MockPrismaService,
    MockNotificationsService,
} from '../../test/test-helpers';
import { createMockUser, resetUserIdCounter } from '../../test/mock-factories';
import { UserStatus, NotificationType } from '@prisma/client';

describe('UsersService', () => {
    let service: UsersService;
    let prisma: MockPrismaService;
    let notificationsService: MockNotificationsService;

    beforeEach(async () => {
        resetUserIdCounter();
        prisma = createMockPrismaService();
        notificationsService = createMockNotificationsService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: PrismaService, useValue: prisma },
                { provide: NotificationsService, useValue: notificationsService },
                { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
            ],
        })
            .setLogger({
                error: jest.fn(),
                log: jest.fn(),
                warn: jest.fn(),
                debug: jest.fn(),
                verbose: jest.fn(),
            } as any)
            .compile();

        service = module.get<UsersService>(UsersService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('updateProfile', () => {
        const userId = 1n;
        const updateDto = {
            fullName: 'Updated Name',
        };

        it('should successfully update user profile', async () => {
            const updatedUser = createMockUser({
                id: userId,
                fullName: updateDto.fullName,
            });
            prisma.user.findFirst.mockResolvedValue(null);
            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.updateProfile(userId, updateDto);

            expect(result).toHaveProperty('message', 'Profile updated successfully');
            expect(result).toHaveProperty('user');
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: userId },
                data: { fullName: updateDto.fullName },
            });
        });

        it('should update address field when provided', async () => {
            const updateWithAddress = { address: '123 Main St, Colombo' };
            const updatedUser = createMockUser({ id: userId, address: updateWithAddress.address });
            prisma.user.findFirst.mockResolvedValue(null);
            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.updateProfile(userId, updateWithAddress);

            expect(result).toHaveProperty('message', 'Profile updated successfully');
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: userId },
                data: { address: updateWithAddress.address },
            });
        });

        it('should update profileImage field when provided', async () => {
            const updateWithImage = { profileImage: 'https://example.com/image.jpg' };
            const updatedUser = createMockUser({ id: userId, profileImage: updateWithImage.profileImage });
            prisma.user.findFirst.mockResolvedValue(null);
            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.updateProfile(userId, updateWithImage);

            expect(result).toHaveProperty('message', 'Profile updated successfully');
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: userId },
                data: { profileImage: updateWithImage.profileImage },
            });
        });

        it('should set address to null when empty string is provided', async () => {
            const updateWithEmptyAddress = { address: '' };
            const updatedUser = createMockUser({ id: userId, address: null });
            prisma.user.findFirst.mockResolvedValue(null);
            prisma.user.update.mockResolvedValue(updatedUser);

            await service.updateProfile(userId, updateWithEmptyAddress);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: userId },
                data: { address: null },
            });
        });

        it('should set phoneNo to null when empty string is provided', async () => {
            const updateWithEmptyPhone = { phoneNo: '' };
            const updatedUser = createMockUser({ id: userId, phoneNo: null });
            prisma.user.findFirst.mockResolvedValue(null);
            prisma.user.update.mockResolvedValue(updatedUser);

            await service.updateProfile(userId, updateWithEmptyPhone);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: userId },
                data: { phoneNo: null },
            });
        });

        it('should not include undefined fields in update', async () => {
            const updateWithOnlyFullName = { fullName: 'New Name' };
            const updatedUser = createMockUser({ id: userId, fullName: updateWithOnlyFullName.fullName });
            prisma.user.findFirst.mockResolvedValue(null);
            prisma.user.update.mockResolvedValue(updatedUser);

            await service.updateProfile(userId, updateWithOnlyFullName);

            const updateCall = prisma.user.update.mock.calls[0][0];
            expect(updateCall.data).not.toHaveProperty('address');
            expect(updateCall.data).not.toHaveProperty('phoneNo');
            expect(updateCall.data).not.toHaveProperty('profileImage');
            expect(updateCall.data).toHaveProperty('fullName', 'New Name');
        });

        it('should throw ConflictException when phone number is already in use', async () => {
            const updateWithPhone = { phoneNo: '+1234567890' };
            const existingUser = createMockUser({ id: 2n, phoneNo: updateWithPhone.phoneNo });
            prisma.user.findFirst.mockResolvedValue(existingUser);

            await expect(service.updateProfile(userId, updateWithPhone))
                .rejects.toThrow(ConflictException);
            await expect(service.updateProfile(userId, updateWithPhone))
                .rejects.toThrow('Phone number is already in use by another account');
        });

        it('should allow update when phone belongs to same user', async () => {
            const updateWithPhone = { phoneNo: '+1234567890' };
            prisma.user.findFirst.mockResolvedValue(null);
            const updatedUser = createMockUser({ id: userId, phoneNo: updateWithPhone.phoneNo });
            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.updateProfile(userId, updateWithPhone);

            expect(result.message).toBe('Profile updated successfully');
        });

        it('should handle notification failure gracefully', async () => {
            const updatedUser = createMockUser({ id: userId });
            prisma.user.findFirst.mockResolvedValue(null);
            prisma.user.update.mockResolvedValue(updatedUser);
            notificationsService.create.mockRejectedValue(new Error('Notification failed'));

            const result = await service.updateProfile(userId, updateDto);

            expect(result).toHaveProperty('message', 'Profile updated successfully');
        });

        it('should create notification with updated fields', async () => {
            const updatedUser = createMockUser({ id: userId });
            prisma.user.findFirst.mockResolvedValue(null);
            prisma.user.update.mockResolvedValue(updatedUser);

            await service.updateProfile(userId, updateDto);

            expect(notificationsService.create).toHaveBeenCalledWith({
                userId: userId,
                type: NotificationType.ACCOUNT,
                title: 'Profile Updated',
                message: 'Your profile information has been successfully updated.',
                data: { updatedFields: Object.keys(updateDto) },
            });
        });

        it('should return current user when no fields are provided', async () => {
            const currentUser = createMockUser({ id: userId });
            prisma.user.findUnique.mockResolvedValue(currentUser);

            const result = await service.updateProfile(userId, {});

            expect(result).toHaveProperty('message', 'No fields to update');
            expect(result).toHaveProperty('user');
            expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: userId } });
            expect(prisma.user.update).not.toHaveBeenCalled();
        });
    });

    describe('deleteAccount', () => {
        const userId = 1n;

        it('should soft delete user account', async () => {
            (prisma as any).userSession = {
                deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            };
            prisma.$transaction.mockImplementation(async (callback: any) => {
                const tx = {
                    userSession: {
                        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                    },
                    user: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                };
                return callback(tx);
            });

            const result = await service.deleteAccount(userId);

            expect(result).toEqual({ message: 'Account deleted successfully' });
            expect(prisma.$transaction).toHaveBeenCalled();
        });

        it('should create security notification on account deletion', async () => {
            (prisma as any).userSession = {
                deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            };
            prisma.$transaction.mockImplementation(async (callback: any) => {
                const tx = {
                    userSession: {
                        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                    },
                    user: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                };
                return callback(tx);
            });

            await service.deleteAccount(userId);

            expect(notificationsService.create).toHaveBeenCalledWith({
                userId: userId,
                type: NotificationType.SECURITY,
                title: 'Account Deactivated',
                message: 'Your account has been marked for deletion as per your request.',
            });
        });

        it('should handle notification failure gracefully during deletion', async () => {
            (prisma as any).userSession = {
                deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            };
            prisma.$transaction.mockImplementation(async (callback: any) => {
                const tx = {
                    userSession: {
                        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                    },
                    user: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                };
                return callback(tx);
            });
            notificationsService.create.mockRejectedValue(new Error('Notification failed'));

            const result = await service.deleteAccount(userId);

            expect(result).toEqual({ message: 'Account deleted successfully' });
        });
    });
});
