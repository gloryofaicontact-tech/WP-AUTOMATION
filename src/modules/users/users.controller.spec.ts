import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UpdateProfileRequestDto } from './dto/requests/update-profile.request.dto';

describe('UsersController', () => {
    let controller: UsersController;
    let usersService: jest.Mocked<UsersService>;

    const mockUsersService = {
        updateProfile: jest.fn(),
        deleteAccount: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                { provide: UsersService, useValue: mockUsersService },
            ],
        }).compile();

        controller = module.get<UsersController>(UsersController);
        usersService = module.get(UsersService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('updateProfile', () => {
        const mockUser = { sub: '1', id: '1', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };
        const updateDto: UpdateProfileRequestDto = {
            fullName: 'Updated Name',
        };

        it('should call usersService.updateProfile with correct parameters', async () => {
            const expectedResult = { message: 'Profile updated successfully', user: {} };
            mockUsersService.updateProfile.mockResolvedValue(expectedResult);

            const result = await controller.updateProfile(mockUser, updateDto);

            expect(result).toEqual(expectedResult);
            expect(usersService.updateProfile).toHaveBeenCalledWith(BigInt(1), updateDto);
        });

        it('should use id if sub is not present', async () => {
            const userWithoutSub = { id: '2', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };
            mockUsersService.updateProfile.mockResolvedValue({ message: 'Updated' });

            await controller.updateProfile(userWithoutSub, updateDto);

            expect(usersService.updateProfile).toHaveBeenCalledWith(BigInt(2), updateDto);
        });
    });

    describe('deleteAccount', () => {
        const mockUser = { sub: '1', id: '1', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };

        it('should call usersService.deleteAccount with correct user id', async () => {
            const expectedResult = { message: 'Account deleted successfully' };
            mockUsersService.deleteAccount.mockResolvedValue(expectedResult);

            const result = await controller.deleteAccount(mockUser);

            expect(result).toEqual(expectedResult);
            expect(usersService.deleteAccount).toHaveBeenCalledWith(BigInt(1));
        });

        it('should use id if sub is not present', async () => {
            const userWithoutSub = { id: '2', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };
            mockUsersService.deleteAccount.mockResolvedValue({ message: 'Deleted' });

            await controller.deleteAccount(userWithoutSub);

            expect(usersService.deleteAccount).toHaveBeenCalledWith(BigInt(2));
        });
    });
});
