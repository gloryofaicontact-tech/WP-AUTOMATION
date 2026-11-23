import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
    createMockPrismaService,
    createMockJwtService,
    createMockConfigService,
    createMockNotificationsService,
    MockPrismaService,
    MockJwtService,
    MockConfigService,
    MockNotificationsService,
} from '../../test/test-helpers';
import { createMockUser, resetUserIdCounter } from '../../test/mock-factories';
import { UserStatus, UserRole, RiskLevel, NotificationType } from '@prisma/client';
import { RegisterStaffRequestDto } from './dto/requests/register-staff.request.dto';

jest.mock('bcrypt', () => ({
    hash: jest.fn().mockResolvedValue('$2b$12$hashedpassword'),
    compare: jest.fn(),
}));

describe('AuthService', () => {
    let service: AuthService;
    let prisma: MockPrismaService;
    let jwtService: MockJwtService;
    let configService: MockConfigService;
    let notificationsService: MockNotificationsService;

    const mockIpAddress = '127.0.0.1';
    const mockUserAgent = 'Mozilla/5.0 Test Agent';

    beforeEach(async () => {
        resetUserIdCounter();

        prisma = createMockPrismaService();
        (prisma as any).userSession = {
            count: jest.fn().mockResolvedValue(0),
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue({ id: 1n, expiresAt: new Date() }),
            update: jest.fn().mockResolvedValue({}),
        };
        (prisma.auditLog as any).count = jest.fn().mockResolvedValue(0);
        jwtService = createMockJwtService();
        configService = createMockConfigService();
        notificationsService = createMockNotificationsService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: PrismaService, useValue: prisma },
                { provide: JwtService, useValue: jwtService },
                { provide: ConfigService, useValue: configService },
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

        service = module.get<AuthService>(AuthService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('register', () => {
        const registerDto = {
            email: 'newuser@test.com',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            fullName: 'John Doe',
            address: '123 Main St',
            phoneNo: '+94771234567',
        };

        it('should throw BadRequestException when password and confirmPassword do not match', async () => {
            const dto = { ...registerDto, confirmPassword: 'OtherPass123!' };
            await expect(service.register(dto, mockIpAddress, mockUserAgent))
                .rejects.toThrow(BadRequestException);
            await expect(service.register(dto, mockIpAddress, mockUserAgent))
                .rejects.toThrow('Password and confirm password do not match');
            expect(prisma.user.findFirst).not.toHaveBeenCalled();
        });

        it('should successfully register a new user', async () => {
            const mockCreatedUser = createMockUser({
                email: registerDto.email,
                fullName: registerDto.fullName,
                phoneNo: registerDto.phoneNo,
            });

            prisma.user.findFirst.mockResolvedValue(null);
            prisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    user: { create: jest.fn().mockResolvedValue(mockCreatedUser) },
                    auditLog: { create: jest.fn().mockResolvedValue({}) },
                };
                return callback(tx);
            });

            const result = await service.register(registerDto, mockIpAddress, mockUserAgent);

            expect(result).toHaveProperty('message', 'User registered successfully.');
            expect(result).toHaveProperty('email', registerDto.email);
            expect(prisma.user.findFirst).toHaveBeenCalledWith({
                where: {
                    OR: [
                        { email: registerDto.email },
                        { phoneNo: registerDto.phoneNo },
                    ],
                    deletedAt: null,
                },
            });
        });



        it('should throw ConflictException when email already exists', async () => {
            const existingUser = createMockUser({ email: registerDto.email });
            prisma.user.findFirst.mockResolvedValue(existingUser);

            await expect(service.register(registerDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow(ConflictException);
            await expect(service.register(registerDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow('Email already in use');
        });

        it('should throw ConflictException when phone number already exists', async () => {
            const existingUser = createMockUser({ phoneNo: registerDto.phoneNo, email: 'other@test.com' });
            prisma.user.findFirst.mockResolvedValue(existingUser);

            await expect(service.register(registerDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow(ConflictException);
            await expect(service.register(registerDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow('Phone number already in use');
        });



        it('should handle notification failure gracefully', async () => {
            const mockCreatedUser = createMockUser({ email: registerDto.email });
            prisma.user.findFirst.mockResolvedValue(null);
            prisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    user: { create: jest.fn().mockResolvedValue(mockCreatedUser) },
                    auditLog: { create: jest.fn().mockResolvedValue({}) },
                };
                return callback(tx);
            });
            notificationsService.create.mockRejectedValue(new Error('Notification failed'));

            const result = await service.register(registerDto, mockIpAddress, mockUserAgent);

            expect(result).toHaveProperty('message');
            expect(result.email).toBe(registerDto.email);
        });
    });

    describe('registerStaff', () => {
        const registerStaffDto: RegisterStaffRequestDto = {
            email: 'staff@test.com',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            fullName: 'Jane Staff',
            address: '123 St',
            phoneNo: '+94771234567',
            role: UserRole.ADMIN,
        };
        const createdByUserId = 1n;

        it('should throw ForbiddenException when creator is not Super Admin', async () => {
            const creator = createMockUser({ id: createdByUserId, role: UserRole.ADMIN });
            prisma.user.findUnique.mockResolvedValue(creator);

            await expect(
                service.registerStaff(registerStaffDto, createdByUserId, mockIpAddress, mockUserAgent),
            ).rejects.toThrow(ForbiddenException);
            await expect(
                service.registerStaff(registerStaffDto, createdByUserId, mockIpAddress, mockUserAgent),
            ).rejects.toThrow('Only Super Admin can create Admin accounts.');
        });

        it('should throw UnauthorizedException when creator user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(
                service.registerStaff(registerStaffDto, createdByUserId, mockIpAddress, mockUserAgent),
            ).rejects.toThrow(UnauthorizedException);
            await expect(
                service.registerStaff(registerStaffDto, createdByUserId, mockIpAddress, mockUserAgent),
            ).rejects.toThrow('User not found');
        });

        it('should throw BadRequestException when role is not ADMIN', async () => {
            const creator = createMockUser({ id: createdByUserId, role: UserRole.SUPER_ADMIN });
            prisma.user.findUnique.mockResolvedValue(creator);
            const dtoWithUserRole = { ...registerStaffDto, role: UserRole.USER };

            await expect(
                service.registerStaff(dtoWithUserRole as RegisterStaffRequestDto, createdByUserId, mockIpAddress, mockUserAgent),
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.registerStaff(dtoWithUserRole as RegisterStaffRequestDto, createdByUserId, mockIpAddress, mockUserAgent),
            ).rejects.toThrow('Only ADMIN accounts can be created');
        });



        it('should successfully register staff with ADMIN role when creator is Super Admin', async () => {
            const creator = createMockUser({ id: createdByUserId, role: UserRole.SUPER_ADMIN });
            const mockCreatedStaff = createMockUser({ email: registerStaffDto.email, role: UserRole.ADMIN });
            prisma.user.findUnique.mockResolvedValue(creator);
            prisma.user.findFirst.mockResolvedValue(null);
            prisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    user: { create: jest.fn().mockResolvedValue(mockCreatedStaff) },
                    auditLog: { create: jest.fn().mockResolvedValue({}) },
                };
                return callback(tx);
            });

            const result = await service.registerStaff(registerStaffDto, createdByUserId, mockIpAddress, mockUserAgent);

            expect(result).toHaveProperty('message', 'Staff registered successfully.');
            expect(result).toHaveProperty('role', UserRole.ADMIN);
            expect(result).toHaveProperty('email', registerStaffDto.email);
        });


    });

    describe('login', () => {
        const loginDto = {
            email: 'user@test.com',
            password: 'Password123!',
        };

        it('should successfully login a valid user', async () => {
            const mockUser = createMockUser({
                email: loginDto.email,
                status: UserStatus.ACTIVE,
            });
            prisma.user.findUnique.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            prisma.user.update.mockResolvedValue(mockUser);
            prisma.auditLog.create.mockResolvedValue({});

            const result = await service.login(loginDto, mockIpAddress, mockUserAgent);

            expect(result).toHaveProperty('message', 'Login successful');
            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
        });

        it('should throw UnauthorizedException when user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(service.login(loginDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when user is deleted', async () => {
            const deletedUser = createMockUser({ deletedAt: new Date() });
            prisma.user.findUnique.mockResolvedValue(deletedUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(service.login(loginDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw ForbiddenException when account is banned', async () => {
            const bannedUser = createMockUser({ status: UserStatus.BANNED });
            prisma.user.findUnique.mockResolvedValue(bannedUser);

            await expect(service.login(loginDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow(ForbiddenException);
            await expect(service.login(loginDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow('Account has been banned');
        });

        it('should throw ForbiddenException when account is suspended', async () => {
            const suspendedUser = createMockUser({ status: UserStatus.SUSPENDED });
            prisma.user.findUnique.mockResolvedValue(suspendedUser);

            await expect(service.login(loginDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow(ForbiddenException);
            await expect(service.login(loginDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow('Account suspended');
        });

        it('should throw ForbiddenException when account is locked', async () => {
            const lockedUser = createMockUser({
                accountLockedUntil: new Date(Date.now() + 3600000),
            });
            prisma.user.findUnique.mockResolvedValue(lockedUser);

            await expect(service.login(loginDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow(ForbiddenException);
            await expect(service.login(loginDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow('Account is temporarily locked');
        });

        it('should throw UnauthorizedException when password is incorrect', async () => {
            const mockUser = createMockUser({ status: UserStatus.ACTIVE });
            prisma.user.findUnique.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);
            prisma.user.update.mockResolvedValue(mockUser);
            prisma.auditLog.create.mockResolvedValue({});

            await expect(service.login(loginDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should allow login when account lock has expired', async () => {
            const mockUser = createMockUser({
                accountLockedUntil: new Date(Date.now() - 1000),
                status: UserStatus.ACTIVE,
            });
            prisma.user.findUnique.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            prisma.user.update.mockResolvedValue(mockUser);
            prisma.auditLog.create.mockResolvedValue({});

            const result = await service.login(loginDto, mockIpAddress, mockUserAgent);

            expect(result).toHaveProperty('message', 'Login successful');
        });
    });

    describe('logout', () => {
        it('should successfully logout user', async () => {
            const userId = 1n;
            const sessionId = 1n;
            const deleteManyMock = jest.fn().mockResolvedValue({ count: 1 });
            (prisma as any).userSession = { deleteMany: deleteManyMock };
            prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma));

            const result = await service.logout(userId, sessionId, mockIpAddress, mockUserAgent);

            expect(result).toEqual({ message: 'Logged out successfully' });
            expect(deleteManyMock).toHaveBeenCalledWith({
                where: { id: sessionId, userId },
            });
        });

        it('should handle notification failure gracefully during logout', async () => {
            const userId = 1n;
            const sessionId = 1n;
            (prisma as any).userSession = { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) };
            prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma));
            notificationsService.create.mockRejectedValue(new Error('Notification failed'));

            const result = await service.logout(userId, sessionId, mockIpAddress, mockUserAgent);

            expect(result).toEqual({ message: 'Logged out successfully' });
        });
    });

    describe('changePassword', () => {
        const changePasswordDto = {
            oldPassword: 'OldPassword123!',
            newPassword: 'NewPassword123!',
            confirmPassword: 'NewPassword123!',
        };
        const userId = 1n;

        it('should successfully change password', async () => {
            const mockUser = createMockUser({ id: userId, status: UserStatus.ACTIVE });
            prisma.user.findUnique.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            prisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    user: { update: jest.fn().mockResolvedValue({}) },
                    userSession: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                    auditLog: { create: jest.fn().mockResolvedValue({}) },
                };
                return callback(tx);
            });

            const result = await service.changePassword(userId, changePasswordDto, mockIpAddress, mockUserAgent);

            expect(result).toEqual({ message: 'Password changed successfully' });
        });

        it('should throw BadRequestException when passwords do not match', async () => {
            const mismatchDto = { ...changePasswordDto, confirmPassword: 'DifferentPassword!' };

            await expect(service.changePassword(userId, mismatchDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow(BadRequestException);
            await expect(service.changePassword(userId, mismatchDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow('Passwords do not match');
        });

        it('should throw UnauthorizedException when user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.changePassword(userId, changePasswordDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when user is deleted', async () => {
            const deletedUser = createMockUser({ deletedAt: new Date() });
            prisma.user.findUnique.mockResolvedValue(deletedUser);

            await expect(service.changePassword(userId, changePasswordDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when user is not active', async () => {
            const inactiveUser = createMockUser({ status: UserStatus.SUSPENDED });
            prisma.user.findUnique.mockResolvedValue(inactiveUser);

            await expect(service.changePassword(userId, changePasswordDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw BadRequestException when old password is incorrect', async () => {
            const mockUser = createMockUser({ id: userId, status: UserStatus.ACTIVE });
            prisma.user.findUnique.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(service.changePassword(userId, changePasswordDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow(BadRequestException);
            await expect(service.changePassword(userId, changePasswordDto, mockIpAddress, mockUserAgent))
                .rejects.toThrow('Invalid old password');
        });
    });

    describe('resetPassword', () => {
        const resetDto = {
            email: 'user@test.com',
            otp: '1234',
            newPassword: 'NewPassword123!',
            confirmPassword: 'NewPassword123!',
        };

        it('should successfully reset password', async () => {
            const mockUser = createMockUser({
                email: resetDto.email,
                passwordResetOtpHash: '$2b$10$hashedotp',
                passwordResetExpires: new Date(Date.now() + 600000),
            });
            prisma.user.findUnique.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            prisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    user: { update: jest.fn().mockResolvedValue({}) },
                    userSession: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                    auditLog: { create: jest.fn().mockResolvedValue({}) },
                };
                return callback(tx);
            });

            const result = await service.resetPassword(resetDto);

            expect(result).toEqual({ message: 'Password reset successfully' });
        });

        it('should throw BadRequestException when passwords do not match', async () => {
            const mismatchDto = { ...resetDto, confirmPassword: 'DifferentPassword!' };

            await expect(service.resetPassword(mismatchDto))
                .rejects.toThrow(BadRequestException);
            await expect(service.resetPassword(mismatchDto))
                .rejects.toThrow('Passwords do not match');
        });

        it('should throw BadRequestException when user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.resetPassword(resetDto))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException when no reset token exists', async () => {
            const mockUser = createMockUser({ passwordResetOtpHash: null });
            prisma.user.findUnique.mockResolvedValue(mockUser);

            await expect(service.resetPassword(resetDto))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException when OTP has expired', async () => {
            const mockUser = createMockUser({
                passwordResetOtpHash: '$2b$10$hashedotp',
                passwordResetExpires: new Date(Date.now() - 1000),
            });
            prisma.user.findUnique.mockResolvedValue(mockUser);

            await expect(service.resetPassword(resetDto))
                .rejects.toThrow(BadRequestException);
            await expect(service.resetPassword(resetDto))
                .rejects.toThrow('OTP has expired');
        });

        it('should throw BadRequestException when OTP is invalid', async () => {
            const mockUser = createMockUser({
                passwordResetOtpHash: '$2b$10$hashedotp',
                passwordResetExpires: new Date(Date.now() + 600000),
            });
            prisma.user.findUnique.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(service.resetPassword(resetDto))
                .rejects.toThrow(BadRequestException);
            await expect(service.resetPassword(resetDto))
                .rejects.toThrow('Invalid OTP code');
        });
    });

    describe('forgotPassword', () => {
        const forgotDto = { email: 'user@test.com' };

        it('should send OTP when user exists', async () => {
            const mockUser = createMockUser({ email: forgotDto.email, status: UserStatus.ACTIVE });
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue({});
            prisma.auditLog.create.mockResolvedValue({});

            const result = await service.forgotPassword(forgotDto);

            expect(result).toEqual({ message: 'If this email exists, an OTP has been sent.' });
        });

        it('should return success message even when user does not exist (security)', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            const result = await service.forgotPassword(forgotDto);

            expect(result).toEqual({ message: 'If this email exists, an OTP has been sent.' });
        });

        it('should return success message when user is banned', async () => {
            const bannedUser = createMockUser({ status: UserStatus.BANNED });
            prisma.user.findUnique.mockResolvedValue(bannedUser);

            const result = await service.forgotPassword(forgotDto);

            expect(result).toEqual({ message: 'If this email exists, an OTP has been sent.' });
        });

        it('should return success message when user is deleted', async () => {
            const deletedUser = createMockUser({ status: UserStatus.DELETED });
            prisma.user.findUnique.mockResolvedValue(deletedUser);

            const result = await service.forgotPassword(forgotDto);

            expect(result).toEqual({ message: 'If this email exists, an OTP has been sent.' });
        });
    });

    describe('getProfile', () => {
        const userId = 1n;

        it('should return user profile', async () => {
            const mockUser = createMockUser({ id: userId, status: UserStatus.ACTIVE });
            prisma.user.findUnique.mockResolvedValue(mockUser);

            const result = await service.getProfile(userId);

            expect(result).toHaveProperty('message', 'Profile retrieved');
            expect(result).toHaveProperty('user');
        });

        it('should throw UnauthorizedException when user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.getProfile(userId))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when user is deleted', async () => {
            const deletedUser = createMockUser({ deletedAt: new Date() });
            prisma.user.findUnique.mockResolvedValue(deletedUser);

            await expect(service.getProfile(userId))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when user is not active', async () => {
            const inactiveUser = createMockUser({ status: UserStatus.SUSPENDED });
            prisma.user.findUnique.mockResolvedValue(inactiveUser);

            await expect(service.getProfile(userId))
                .rejects.toThrow(UnauthorizedException);
        });
    });



    describe('sendEmailVerifyOtp', () => {
        it('should send OTP and return message and token', async () => {
            configService.getOrThrow.mockReturnValue('jwt-secret');

            const result = await service.sendEmailVerifyOtp('user@example.com');

            expect(result).toHaveProperty('message', 'Verification code sent to your email');
            expect(result).toHaveProperty('token');
            expect(result.token).toMatch(/^.+\.[a-f0-9]+$/);
        });
    });

    describe('verifyEmailOtp', () => {
        it('should throw BadRequestException when token has wrong number of parts', async () => {
            await expect(service.verifyEmailOtp('1234', 'single-part'))
                .rejects.toThrow(BadRequestException);
            await expect(service.verifyEmailOtp('1234', 'single-part'))
                .rejects.toThrow('Invalid verification token');
        });

        it('should throw BadRequestException when token payload is invalid JSON', async () => {
            const invalidPayload = Buffer.from('not-json', 'utf8').toString('base64url');
            await expect(service.verifyEmailOtp('1234', `${invalidPayload}.anyhmac`))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException when verification code has expired', async () => {
            const expiredMs = Date.now() - 10000;
            const payload = Buffer.from(JSON.stringify({ email: 'u@e.com', expiresAt: String(expiredMs) }), 'utf8').toString('base64url');
            const crypto = require('crypto');
            const hmac = crypto.createHmac('sha256', 'secret').update(`u@e.com:1234:${expiredMs}`).digest('hex');
            configService.getOrThrow.mockReturnValue('secret');

            await expect(service.verifyEmailOtp('1234', `${payload}.${hmac}`))
                .rejects.toThrow(BadRequestException);
            await expect(service.verifyEmailOtp('1234', `${payload}.${hmac}`))
                .rejects.toThrow('Verification code has expired');
        });

        it('should return verified true when OTP and token are valid', async () => {
            const expiresAtMs = Date.now() + 600000;
            const payload = Buffer.from(JSON.stringify({ email: 'u@e.com', expiresAt: String(expiresAtMs) }), 'utf8').toString('base64url');
            const crypto = require('crypto');
            const hmac = crypto.createHmac('sha256', 'secret').update(`u@e.com:1234:${expiresAtMs}`).digest('hex');
            configService.getOrThrow.mockReturnValue('secret');

            const result = await service.verifyEmailOtp('1234', `${payload}.${hmac}`);

            expect(result).toEqual({ message: 'Email verified successfully', verified: true });
        });
    });

    describe('getSessions', () => {
        const userId = 1n;

        it('should return sessions for user', async () => {
            const mockSessions = [
                { id: 1n, deviceName: null, ipAddress: '127.0.0.1', userAgent: 'Mozilla', lastActiveAt: new Date(), createdAt: new Date() },
            ];
            (prisma as any).userSession = { ...(prisma as any).userSession, findMany: jest.fn().mockResolvedValue(mockSessions) };

            const result = await service.getSessions(userId);

            expect(result).toHaveProperty('message', 'Sessions retrieved');
            expect(result.sessions).toHaveLength(1);
            expect(result.sessions[0].id).toBe('1');
        });
    });

    describe('revokeSession', () => {
        const userId = 1n;
        const sessionId = '1';

        it('should revoke session when found', async () => {
            (prisma as any).userSession = { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) };
            prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma));

            const result = await service.revokeSession(userId, sessionId, mockIpAddress, mockUserAgent);

            expect(result.message).toBe('Session revoked successfully');
            expect(result.sessionId).toBe('1');
        });

        it('should return session not found when delete count is 0', async () => {
            (prisma as any).userSession = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) };
            prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma));

            const result = await service.revokeSession(userId, sessionId, mockIpAddress, mockUserAgent);

            expect(result.message).toBe('Session not found');
        });
    });

    describe('logoutAll', () => {
        const userId = 1n;

        it('should revoke all sessions and return count', async () => {
            (prisma as any).userSession = { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) };
            prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma));

            const result = await service.logoutAll(userId, mockIpAddress, mockUserAgent);

            expect(result.message).toContain('2 device(s)');
            expect(result.revokedCount).toBe(2);
        });
    });
});
