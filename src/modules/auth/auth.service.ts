import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserRole, UserStatus, User, TokenType, NotificationType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { RegisterRequestDto } from './dto/requests/register.request.dto';
import { RegisterStaffRequestDto } from './dto/requests/register-staff.request.dto';
import { LoginRequestDto } from './dto/requests/login.request.dto';
import { AuthUserResponseDto } from './dto/responses/auth-user.response.dto';
import { ChangePasswordRequestDto } from './dto/requests/change-password.request.dto';
import { ForgotPasswordRequestDto } from './dto/requests/forgot-password.request.dto';
import { ResetPasswordRequestDto } from './dto/requests/reset-password.request.dto';
import { RefreshTokenRequestDto } from './dto/requests/refresh-token.request.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { logAudit } from '../../common/utils/audit.util';

const DUMMY_PASSWORD_HASH = '$2b$12$PcXSboIVoeL.6tM7V2fIV.j7.3/1/1/1/1/1/1/1/1/1/1/1/1';
const EMAIL_VERIFY_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS: number;
  private readonly REFRESH_TOKEN_EXPIRY_DAYS: number;
  private readonly MAX_SESSIONS_PER_USER: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
    private readonly cache: CacheService,
  ) {
    this.BCRYPT_ROUNDS = this.configService.get<number>('security.password.bcryptRounds', 12);
    const refreshExpiry = this.configService.get<string>('jwt.refreshExpiresIn', '7d');
    this.REFRESH_TOKEN_EXPIRY_DAYS = this.parseExpiryToDays(refreshExpiry);
    this.MAX_SESSIONS_PER_USER = this.configService.get<number>('security.session.maxSessionsPerUser', 5);
  }

  private parseExpiryToDays(expiry: string): number {
    const match = expiry.match(/^(\d+)([dhms])$/);
    if (!match) return 7;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'd': return value;
      case 'h': return value / 24;
      case 'm': return value / (24 * 60);
      case 's': return value / (24 * 60 * 60);
      default: return 7;
    }
  }

  private async assertEmailUnique(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }
  }

  async register(dto: RegisterRequestDto, ipAddress: string, userAgent: string) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Password and confirm password do not match');
    }

    await this.assertEmailUnique(dto.email);

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          role: UserRole.EDITOR,
          status: UserStatus.ACTIVE,
        },
      });

      await logAudit(tx, {
        userId: user.id,
        action: 'USER_REGISTERED',
        entity: 'User',
        entityId: user.id,
        ipAddress,
        details: { userAgent, role: user.role },
      });

      return user;
    });

    try {
      await this.notificationsService.create({
        userId: newUser.id,
        type: NotificationType.SYSTEM,
        title: 'Welcome to WP Blog Automation',
        message: `Hi ${newUser.fullName}, your account has been successfully created.`,
      });
    } catch (error) {
      this.logger.error(`Failed to create welcome notification for user ${newUser.id}`, error);
    }

    try {
      await this.mailService.sendWelcomeEmail(newUser.email, newUser.fullName);
    } catch (error) {
      this.logger.error(`Failed to send welcome email for user ${newUser.id}`, error);
    }

    return {
      message: 'User registered successfully.',
      email: newUser.email,
      createdAt: newUser.createdAt,
    };
  }

  async registerStaff(
    dto: RegisterStaffRequestDto,
    createdByUserId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Password and confirm password do not match');
    }

    await this.assertEmailUnique(dto.email);

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          role: dto.role,
          status: UserStatus.INVITED,
        },
      });

      await logAudit(tx, {
        userId: user.id,
        action: 'STAFF_INVITED',
        entity: 'User',
        entityId: user.id,
        ipAddress,
        details: { createdByUserId, role: dto.role, userAgent },
      });

      return user;
    });

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');

    await this.prisma.authToken.create({
      data: {
        userId: newUser.id,
        tokenHash,
        type: TokenType.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + EMAIL_VERIFY_TOKEN_EXPIRY_MS),
      },
    });

    try {
      await this.mailService.sendInvitationEmail(newUser.email, newUser.role, inviteToken);
    } catch (error) {
      this.logger.error(`Failed to send invitation email to staff ${newUser.id}`, error);
    }

    return {
      message: 'Staff registered and invitation email sent successfully.',
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
    };
  }

  async login(dto: LoginRequestDto, ipAddress: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      await bcrypt.compare('dummy_password', DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Account suspended');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Active sessions management
    const activeSessionsCount = await this.prisma.userSession.count({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (activeSessionsCount >= this.MAX_SESSIONS_PER_USER) {
      const oldestSession = await this.prisma.userSession.findFirst({
        where: { userId: user.id, revokedAt: null },
        orderBy: { lastActiveAt: 'asc' },
      });
      if (oldestSession) {
        await this.prisma.userSession.update({
          where: { id: oldestSession.id },
          data: { revokedAt: new Date() },
        });
      }
    }

    const sessionExpiresAt = new Date();
    sessionExpiresAt.setDate(sessionExpiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: crypto.randomBytes(32).toString('hex'),
        deviceName: dto.deviceName || 'Unknown Device',
        ipAddress,
        userAgent,
        expiresAt: sessionExpiresAt,
        lastActiveAt: new Date(),
      },
    });

    const accessToken = await this.generateAccessToken(user, session.id);
    const { refreshToken } = await this.generateRefreshToken(user, session.id);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { refreshTokenHash },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        userId: user.id,
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: user.id,
        ipAddress,
        details: { sessionId: session.id, deviceName: dto.deviceName },
      });
    });

    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
    };
  }

  async logout(userId: string, sessionId: string, ipAddress: string, userAgent: string) {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: new Date() },
    });

    await this.prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        userId,
        action: 'USER_LOGOUT',
        entity: 'UserSession',
        entityId: sessionId,
        ipAddress,
        details: { userAgent },
      });
    });

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string, ipAddress: string, userAgent: string) {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        userId,
        action: 'USER_LOGOUT_ALL',
        entity: 'UserSession',
        entityId: userId,
        ipAddress,
        details: { userAgent },
      });
    });

    return { message: 'All sessions revoked successfully' };
  }

  async refreshToken(dto: RefreshTokenRequestDto, ipAddress: string, userAgent: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.configService.getOrThrow('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh' || !payload.sessionId) {
      throw new UnauthorizedException('Invalid token structure');
    }

    const session = await this.prisma.userSession.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session || !session.user) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    const isTokenValid = await bcrypt.compare(dto.refreshToken, session.refreshTokenHash);
    if (!isTokenValid) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token reuse detected. Session revoked.');
    }

    const user = session.user;
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);
    }

    const newAccessToken = await this.generateAccessToken(user, session.id);
    const { refreshToken: newRefreshToken } = await this.generateRefreshToken(user, session.id);

    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        lastActiveAt: new Date(),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);
    }

    return {
      message: 'Profile retrieved',
      user: plainToInstance(AuthUserResponseDto, user, { excludeExtraneousValues: true }),
    };
  }

  async getSessions(userId: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true,
        deviceName: true,
        ipAddress: true,
        userAgent: true,
        lastActiveAt: true,
        createdAt: true,
      },
    });

    return {
      message: 'Active sessions retrieved',
      sessions,
    };
  }

  async revokeSession(userId: string, sessionId: string, ipAddress: string, userAgent: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await this.prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        userId,
        action: 'REVOKE_SESSION',
        entity: 'UserSession',
        entityId: sessionId,
        ipAddress,
        details: { userAgent },
      });
    });

    return { message: 'Session revoked successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordRequestDto, ipAddress: string, userAgent: string) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirm password do not match');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isOldValid = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isOldValid) {
      throw new BadRequestException('Current password does not match');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, this.BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      await logAudit(tx, {
        userId,
        action: 'PASSWORD_CHANGED',
        entity: 'User',
        entityId: userId,
        ipAddress,
        details: { userAgent },
      });
    });

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(dto: ForgotPasswordRequestDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || user.status === UserStatus.SUSPENDED) {
      return { message: 'If this email exists, a password reset token has been sent.' };
    }

    const rawToken = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MS);

    await this.prisma.authToken.deleteMany({
      where: { userId: user.id, type: TokenType.PASSWORD_RESET },
    });

    await this.prisma.authToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: TokenType.PASSWORD_RESET,
        expiresAt,
      },
    });

    try {
      await this.mailService.sendPasswordResetEmail(user.email, rawToken);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${user.email}`, error);
    }

    await this.prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        userId: user.id,
        action: 'FORGOT_PASSWORD_REQUEST',
        entity: 'User',
        entityId: user.id,
        ipAddress: '',
        details: { email: user.email },
      });
    });

    return { message: 'If this email exists, a password reset token has been sent.' };
  }

  async resetPassword(dto: ResetPasswordRequestDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new BadRequestException('Invalid request or expired token');
    }

    const tokenHash = crypto.createHash('sha256').update(dto.otp).digest('hex');

    const authToken = await this.prisma.authToken.findFirst({
      where: {
        userId: user.id,
        tokenHash,
        type: TokenType.PASSWORD_RESET,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!authToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, this.BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });

      await tx.authToken.update({
        where: { id: authToken.id },
        data: { usedAt: new Date() },
      });

      await tx.userSession.updateMany({
        where: { userId: user.id },
        data: { revokedAt: new Date() },
      });

      await logAudit(tx, {
        userId: user.id,
        action: 'PASSWORD_RESET_SUCCESS',
        entity: 'User',
        entityId: user.id,
        ipAddress: '',
      });
    });

    return { message: 'Password has been successfully reset' };
  }

  async sendEmailVerifyOtp(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const rawToken = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TOKEN_EXPIRY_MS);

    await this.prisma.authToken.deleteMany({
      where: { userId: user.id, type: TokenType.EMAIL_VERIFICATION },
    });

    await this.prisma.authToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: TokenType.EMAIL_VERIFICATION,
        expiresAt,
      },
    });

    try {
      await this.mailService.sendEmailVerification(email, rawToken);
    } catch (error) {
      this.logger.error(`Failed to send email verification to ${email}`, error);
    }

    return {
      message: 'Verification code sent to your email',
    };
  }

  async verifyEmailOtp(otp: string, emailOrToken?: string) {
    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');

    const authToken = await this.prisma.authToken.findFirst({
      where: {
        tokenHash,
        type: TokenType.EMAIL_VERIFICATION,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!authToken || !authToken.user) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: authToken.userId },
        data: {
          emailVerifiedAt: new Date(),
          status: UserStatus.ACTIVE,
        },
      });

      await tx.authToken.update({
        where: { id: authToken.id },
        data: { usedAt: new Date() },
      });
    });

    return {
      message: 'Email verified successfully',
      verified: true,
    };
  }

  private async generateAccessToken(user: User, sessionId: string): Promise<string> {
    const payload = {
      sub: user.id,
      sessionId,
      email: user.email,
      role: user.role,
      type: 'access' as const,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn', '15m'),
      issuer: this.configService.get<string>('jwt.issuer', 'backend-api'),
      audience: this.configService.get<string>('jwt.audience', 'backend-client'),
    });
  }

  private async generateRefreshToken(user: User, sessionId: string): Promise<{ refreshToken: string; expiresAt: Date }> {
    const payload = {
      sub: user.id,
      sessionId,
      type: 'refresh' as const,
      jti: crypto.randomUUID(),
    };

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn', '7d'),
      issuer: this.configService.get<string>('jwt.issuer', 'backend-api'),
      audience: this.configService.get<string>('jwt.audience', 'backend-client'),
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    return { refreshToken, expiresAt };
  }
}
