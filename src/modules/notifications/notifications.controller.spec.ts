import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

describe('NotificationsController', () => {
    let controller: NotificationsController;
    let notificationsService: jest.Mocked<NotificationsService>;

    const mockNotificationsService = {
        findAll: jest.fn(),
        markAsRead: jest.fn(),
        markAllAsRead: jest.fn(),
        remove: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [NotificationsController],
            providers: [
                { provide: NotificationsService, useValue: mockNotificationsService },
            ],
        }).compile();

        controller = module.get<NotificationsController>(NotificationsController);
        notificationsService = module.get(NotificationsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('findAll', () => {
        const mockUser = { sub: '1', id: '1', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };
        const paginationDto: PaginationDto = { page: 1, limit: 10 };

        it('should call notificationsService.findAll with correct parameters', async () => {
            const expectedResult = { data: [], meta: { total: 0, unreadCount: 0 } };
            mockNotificationsService.findAll.mockResolvedValue(expectedResult);

            const result = await controller.findAll(mockUser, paginationDto);

            expect(result).toEqual(expectedResult);
            expect(notificationsService.findAll).toHaveBeenCalledWith(BigInt(1), paginationDto);
        });

        it('should use id if sub is not present', async () => {
            const userWithoutSub = { id: '2', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };
            mockNotificationsService.findAll.mockResolvedValue({ data: [], meta: {} });

            await controller.findAll(userWithoutSub, paginationDto);

            expect(notificationsService.findAll).toHaveBeenCalledWith(BigInt(2), paginationDto);
        });
    });

    describe('markAllAsRead', () => {
        const mockUser = { sub: '1', id: '1', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };

        it('should call notificationsService.markAllAsRead with user id', async () => {
            const expectedResult = { message: 'All notifications marked as read' };
            mockNotificationsService.markAllAsRead.mockResolvedValue(expectedResult);

            const result = await controller.markAllAsRead(mockUser);

            expect(result).toEqual(expectedResult);
            expect(notificationsService.markAllAsRead).toHaveBeenCalledWith(BigInt(1));
        });
    });

    describe('markAsRead', () => {
        const mockUser = { sub: '1', id: '1', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };
        const notificationId = '5';

        it('should call notificationsService.markAsRead with correct parameters', async () => {
            const expectedResult = { message: 'Notification marked as read' };
            mockNotificationsService.markAsRead.mockResolvedValue(expectedResult);

            const result = await controller.markAsRead(mockUser, notificationId);

            expect(result).toEqual(expectedResult);
            expect(notificationsService.markAsRead).toHaveBeenCalledWith(5, BigInt(1));
        });
    });

    describe('remove', () => {
        const mockUser = { sub: '1', id: '1', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };
        const notificationId = '5';

        it('should call notificationsService.remove with correct parameters', async () => {
            const expectedResult = { message: 'Notification deleted successfully' };
            mockNotificationsService.remove.mockResolvedValue(expectedResult);

            const result = await controller.remove(mockUser, notificationId);

            expect(result).toEqual(expectedResult);
            expect(notificationsService.remove).toHaveBeenCalledWith(5, BigInt(1));
        });
    });
});
