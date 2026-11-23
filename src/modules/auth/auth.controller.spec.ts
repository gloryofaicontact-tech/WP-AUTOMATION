import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RegisterRequestDto } from './dto/requests/register.request.dto';
import { LoginRequestDto } from './dto/requests/login.request.dto';
import { ChangePasswordRequestDto } from './dto/requests/change-password.request.dto';
import { ForgotPasswordRequestDto } from './dto/requests/forgot-password.request.dto';
import { ResetPasswordRequestDto } from './dto/requests/reset-password.request.dto';
import { RefreshTokenRequestDto } from './dto/requests/refresh-token.request.dto';
import { RegisterStaffRequestDto } from './dto/requests/register-staff.request.dto';
import { UserRole } from '@prisma/client';

describe('AuthController', () => {
    let controller: AuthController;
    let authService: jest.Mocked<AuthService>;

    const mockAuthService = {
        register: jest.fn(),
        login: jest.fn(),
        logout: jest.fn(),
        getProfile: jest.fn(),
        changePassword: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
        registerStaff: jest.fn(),
        refreshToken: jest.fn(),
        getSessions: jest.fn(),
        revokeSession: jest.fn(),
        logoutAll: jest.fn(),
        sendEmailVerifyOtp: jest.fn(),
        verifyEmailOtp: jest.fn(),
    };

    const mockIpAddress = '127.0.0.1';
    const mockUserAgent = 'Mozilla/5.0 Test Agent';
    const mockRequest = {
        headers: { 'user-agent': mockUserAgent },
    } as any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                { provide: AuthService, useValue: mockAuthService },
            ],
        })
            .overrideGuard(ThrottlerGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<AuthController>(AuthController);
        authService = module.get(AuthService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('register', () => {
        const registerDto: RegisterRequestDto = {
            email: 'newuser@test.com',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            fullName: 'John Doe',
            address: '123 Main St',
            phoneNo: '+94771234567',
        };

        it('should call authService.register with correct parameters', async () => {
            const expectedResult = { message: 'User registered successfully', id: '1', email: registerDto.email };
            mockAuthService.register.mockResolvedValue(expectedResult);

            const result = await controller.register(registerDto, mockIpAddress, mockRequest);

            expect(result).toEqual(expectedResult);
            expect(authService.register).toHaveBeenCalledWith(registerDto, mockIpAddress, mockUserAgent);
        });

        it('should handle missing user-agent header', async () => {
            const requestWithoutAgent = { headers: {} } as any;
            mockAuthService.register.mockResolvedValue({ message: 'Success' });

            await controller.register(registerDto, mockIpAddress, requestWithoutAgent);

            expect(authService.register).toHaveBeenCalledWith(registerDto, mockIpAddress, 'Unknown');
        });
    });

    describe('registerStaff', () => {
        const registerStaffDto: RegisterStaffRequestDto = {
            ...{
                email: 'staff@test.com',
                password: 'Password123!',
                confirmPassword: 'Password123!',
                fullName: 'Jane Staff',
                address: '123 St',
                phoneNo: '+94771234567',
            },
            role: UserRole.ADMIN,
        };
        const mockSuperAdmin = { sub: '1', id: '1', email: '', fullName: '', role: UserRole.SUPER_ADMIN, status: 'ACTIVE' };

        it('should call authService.registerStaff with dto and super admin user id', async () => {
            const expectedResult = { message: 'Staff registered successfully.', id: '2', email: registerStaffDto.email, role: UserRole.ADMIN };
            mockAuthService.registerStaff.mockResolvedValue(expectedResult);

            const result = await controller.registerStaff(registerStaffDto, mockSuperAdmin, mockIpAddress, mockRequest);

            expect(result).toEqual(expectedResult);
            expect(authService.registerStaff).toHaveBeenCalledWith(
                registerStaffDto,
                BigInt(1),
                mockIpAddress,
                mockUserAgent,
            );
        });
    });

    describe('login', () => {
        const loginDto: LoginRequestDto = {
            email: 'user@test.com',
            password: 'Password123!',
        };

        it('should call authService.login with correct parameters', async () => {
            const expectedResult = { message: 'Login successful', accessToken: 'token', user: {} };
            mockAuthService.login.mockResolvedValue(expectedResult);

            const result = await controller.login(loginDto, mockIpAddress, mockRequest);

            expect(result).toEqual(expectedResult);
            expect(authService.login).toHaveBeenCalledWith(loginDto, mockIpAddress, mockUserAgent);
        });
    });

    describe('logout', () => {
        const mockUser = { sub: '1', id: '1', sessionId: '1', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };

        it('should call authService.logout with user id and sessionId', async () => {
            const expectedResult = { message: 'Logged out successfully' };
            mockAuthService.logout.mockResolvedValue(expectedResult);

            const result = await controller.logout(mockUser, mockIpAddress, mockRequest);

            expect(result).toEqual(expectedResult);
            expect(authService.logout).toHaveBeenCalledWith(BigInt(1), BigInt(1), mockIpAddress, mockUserAgent);
        });

        it('should use id if sub is not present and call authService.logout when sessionId present', async () => {
            const userWithSession = { id: '2', sessionId: '1', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };
            mockAuthService.logout.mockResolvedValue({ message: 'Logged out' });

            await controller.logout(userWithSession, mockIpAddress, mockRequest);

            expect(authService.logout).toHaveBeenCalledWith(BigInt(2), BigInt(1), mockIpAddress, mockUserAgent);
        });

        it('should return success without calling authService.logout when sessionId is missing', async () => {
            const userWithoutSession = { sub: '1', id: '1', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };
            const result = await controller.logout(userWithoutSession, mockIpAddress, mockRequest);

            expect(result).toEqual({ message: 'Logged out successfully' });
            expect(authService.logout).not.toHaveBeenCalled();
        });
    });

    describe('getCurrentUser', () => {
        const mockUser = { sub: '1', id: '1', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };

        it('should call authService.getProfile with user id', async () => {
            const expectedResult = { message: 'Profile retrieved', user: { email: 'test@test.com' } };
            mockAuthService.getProfile.mockResolvedValue(expectedResult);

            const result = await controller.getCurrentUser(mockUser);

            expect(result).toEqual(expectedResult);
            expect(authService.getProfile).toHaveBeenCalledWith(BigInt(1));
        });
    });

    describe('changePassword', () => {
        const mockUser = { sub: '1', id: '1', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };
        const changePasswordDto: ChangePasswordRequestDto = {
            oldPassword: 'OldPassword123!',
            newPassword: 'NewPassword123!',
            confirmPassword: 'NewPassword123!',
        };

        it('should call authService.changePassword with correct parameters', async () => {
            const expectedResult = { message: 'Password changed successfully' };
            mockAuthService.changePassword.mockResolvedValue(expectedResult);

            const result = await controller.changePassword(mockUser, changePasswordDto, mockIpAddress, mockRequest);

            expect(result).toEqual(expectedResult);
            expect(authService.changePassword).toHaveBeenCalledWith(
                BigInt(1),
                changePasswordDto,
                mockIpAddress,
                mockUserAgent
            );
        });
    });

    describe('forgotPassword', () => {
        const forgotPasswordDto: ForgotPasswordRequestDto = {
            email: 'user@test.com',
        };

        it('should call authService.forgotPassword with correct parameters', async () => {
            const expectedResult = { message: 'If this email exists, an OTP has been sent.' };
            mockAuthService.forgotPassword.mockResolvedValue(expectedResult);

            const result = await controller.forgotPassword(forgotPasswordDto);

            expect(result).toEqual(expectedResult);
            expect(authService.forgotPassword).toHaveBeenCalledWith(forgotPasswordDto);
        });
    });

    describe('resetPassword', () => {
        const resetPasswordDto: ResetPasswordRequestDto = {
            email: 'user@test.com',
            otp: '1234',
            newPassword: 'NewPassword123!',
            confirmPassword: 'NewPassword123!',
        };

        it('should call authService.resetPassword with correct parameters', async () => {
            const expectedResult = { message: 'Password reset successfully' };
            mockAuthService.resetPassword.mockResolvedValue(expectedResult);

            const result = await controller.resetPassword(resetPasswordDto);

            expect(result).toEqual(expectedResult);
            expect(authService.resetPassword).toHaveBeenCalledWith(resetPasswordDto);
        });
    });

    describe('refreshToken', () => {
        const refreshDto: RefreshTokenRequestDto = { refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' };

        it('should call authService.refreshToken with dto, ip and userAgent', async () => {
            const expectedResult = { message: 'Token refreshed successfully', accessToken: 'at', refreshToken: 'rt' };
            mockAuthService.refreshToken.mockResolvedValue(expectedResult);

            const result = await controller.refreshToken(refreshDto, mockIpAddress, mockRequest);

            expect(result).toEqual(expectedResult);
            expect(authService.refreshToken).toHaveBeenCalledWith(refreshDto, mockIpAddress, mockUserAgent);
        });
    });

    describe('getSessions', () => {
        const mockUser = { sub: '1', id: '1', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };

        it('should call authService.getSessions with user id', async () => {
            const expectedResult = { message: 'Sessions retrieved', sessions: [] };
            mockAuthService.getSessions.mockResolvedValue(expectedResult);

            const result = await controller.getSessions(mockUser);

            expect(result).toEqual(expectedResult);
            expect(authService.getSessions).toHaveBeenCalledWith(BigInt(1));
        });
    });

    describe('revokeSession', () => {
        const mockUser = { sub: '1', id: '1', sessionId: '1', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };

        it('should call authService.revokeSession with user id, sessionId, ip and userAgent', async () => {
            const expectedResult = { message: 'Session revoked successfully' };
            mockAuthService.revokeSession.mockResolvedValue(expectedResult);

            const result = await controller.revokeSession(mockUser, '1', mockIpAddress, mockRequest);

            expect(result).toEqual(expectedResult);
            expect(authService.revokeSession).toHaveBeenCalledWith(BigInt(1), '1', mockIpAddress, mockUserAgent);
        });
    });

    describe('revokeAllSessions', () => {
        const mockUser = { sub: '1', id: '1', email: '', fullName: '', role: 'USER' as const, status: 'ACTIVE' };

        it('should call authService.logoutAll with user id, ip and userAgent', async () => {
            const expectedResult = { message: 'Logged out from 2 device(s) successfully' };
            mockAuthService.logoutAll.mockResolvedValue(expectedResult);

            const result = await controller.revokeAllSessions(mockUser, mockIpAddress, mockRequest);

            expect(result).toEqual(expectedResult);
            expect(authService.logoutAll).toHaveBeenCalledWith(BigInt(1), mockIpAddress, mockUserAgent);
        });
    });

    describe('sendEmailVerifyOtp', () => {
        it('should call authService.sendEmailVerifyOtp with email from dto', async () => {
            const dto = { email: 'user@example.com' };
            const expectedResult = { message: 'Verification code sent to your email', token: 'payload.hmac' };
            mockAuthService.sendEmailVerifyOtp.mockResolvedValue(expectedResult);

            const result = await controller.sendEmailVerifyOtp(dto);

            expect(result).toEqual(expectedResult);
            expect(authService.sendEmailVerifyOtp).toHaveBeenCalledWith('user@example.com');
        });
    });

    describe('verifyEmailOtp', () => {
        it('should call authService.verifyEmailOtp with otp and token from dto', async () => {
            const dto = { otp: '1234', token: 'payload.hmac' };
            const expectedResult = { message: 'Email verified successfully', verified: true };
            mockAuthService.verifyEmailOtp.mockResolvedValue(expectedResult);

            const result = await controller.verifyEmailOtp(dto);

            expect(result).toEqual(expectedResult);
            expect(authService.verifyEmailOtp).toHaveBeenCalledWith('1234', 'payload.hmac');
        });
    });
});
