import { Injectable, UnauthorizedException, ForbiddenException, Logger, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserRole, UserStatus, User, RiskLevel, NotificationType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { RegisterRequestDto } from './dto/requests/register.request.dto';
import { RegisterStaffRequestDto, STAFF_REGISTER_ALLOWED_ROLES, } from './dto/requests/register-staff.request.dto';
import { LoginRequestDto } from './dto/requests/login.request.dto';
import { AuthUserResponseDto } from './dto/responses/auth-user.response.dto';
import { ChangePasswordRequestDto } from './dto/requests/change-password.request.dto';
import { ForgotPasswordRequestDto } from './dto/requests/forgot-password.request.dto';
import { ResetPasswordRequestDto } from './dto/requests/reset-password.request.dto';
import { RefreshTokenRequestDto } from './dto/requests/refresh-token.request.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { logAudit } from '../../common/utils/audit.util';
import { isUuid } from '../../common/utils/uuid.util';

const DUMMY_PASSWORD_HASH = '$2b$12$PcXSboIVoeL.6tM7V2fIV.j7.3/1/1/1/1/1/1/1/1/1/1/1/1';
/** Email verification OTP expiry: 10 minutes (no database; token bound to expiry) */
const EMAIL_VERIFY_OTP_EXPIRY_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_LOGIN_ATTEMPTS: number;
  private readonly ACCOUNT_LOCK_DURATION: number;
  private readonly FAILED_LOGIN_RESET_TIME: number;
  private readonly BCRYPT_ROUNDS: number;
  private readonly PASSWORD_RESET_TOKEN_EXPIRY: number;
  private readonly PASSWORD_RESET_MAX_ATTEMPTS: number;
  private readonly REFRESH_TOKEN_EXPIRY_DAYS: number;
  private readonly MAX_SESSIONS_PER_USER: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly cache: CacheService,
  ) {
    this.MAX_LOGIN_ATTEMPTS = this.configService.get<number>('security.lockout.maxLoginAttempts', 5);
    this.ACCOUNT_LOCK_DURATION = this.configService.get<number>('security.lockout.lockDuration', 1800000);
    this.FAILED_LOGIN_RESET_TIME = this.configService.get<number>('security.lockout.failedLoginResetTime', 900000);
    this.BCRYPT_ROUNDS = this.configService.get<number>('security.password.bcryptRounds', 12);
    this.PASSWORD_RESET_TOKEN_EXPIRY = this.configService.get<number>('security.password.resetTokenExpiry', 3600000);
    this.PASSWORD_RESET_MAX_ATTEMPTS = this.configService.get<number>('security.password.resetMaxAttempts', 3);

    // Parse refresh token expiry (e.g., '7d' -> 7 days)
    const refreshExpiry = this.configService.get<string>('jwt.refreshExpiresIn', '7d');
    this.REFRESH_TOKEN_EXPIRY_DAYS = this.parseExpiryToDays(refreshExpiry);
    this.MAX_SESSIONS_PER_USER = this.configService.get<number>('security.session.maxSessionsPerUser', 5);
  }

  /**
   * Parse expiry string (e.g., '7d', '30d', '1h') to days
   */
  private parseExpiryToDays(expiry: string): number {
    const match = expiry.match(/^(\d+)([dhms])$/);
    if (!match) return 7; // Default 7 days

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

  /**
   * Validates uniqueness of email and phoneNo (used by both register and registerStaff).
   * Throws ConflictException with a clear message when any value is already in use.
   */
  private async assertUserUniqueness(params: {
    email: string;
    phoneNo?: string | null;
  }): Promise<void> {
    const orConditions: Array<{ email: string } | { phoneNo: string | null }> = [
      { email: params.email },
      ...(params.phoneNo ? [{ phoneNo: params.phoneNo }] : []),
    ];

    const existingUser = await this.prisma.user.findFirst({
      where: { OR: orConditions, deletedAt: null },
    });

    if (existingUser) {
      if (existingUser.email === params.email) {
        throw new ConflictException('Email already in use');
      }
      if (params.phoneNo && existingUser.phoneNo === params.phoneNo) {
        throw new ConflictException('Phone number already in use');
      }
    }
  }

  async register(dto: RegisterRequestDto, ipAddress: string, userAgent: string) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Password and confirm password do not match');
    }

    await this.assertUserUniqueness({
      email: dto.email,
      phoneNo: dto.phoneNo ?? null,
    });

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          address: dto.address,
          phoneNo: dto.phoneNo,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          lastLoginIp: ipAddress,
        },
      });

      await logAudit(tx, {
        userId: user.id,
        action: 'USER_REGISTERED',
        entity: 'User',
        entityId: user.id.toString(),
        ipAddress,
        userAgent,
        riskLevel: RiskLevel.LOW,
      });

      return user;
    });

    try {
      await this.notificationsService.create({
        userId: newUser.id,
        type: NotificationType.SYSTEM,
        title: 'Welcome to Classifieds!',
        message: `Hi ${newUser.fullName}, your account has been successfully created.`,
        data: { email: newUser.email }
      });
    } catch (error) {
      this.logger.error(`Failed to create welcome notification for user ${newUser.id}`, error);
    }

    return {
      message: 'User registered successfully.',
      email: newUser.email,
      createdAt: newUser.createdAt,
    };
  }


  async registerStaff(
    dto: RegisterStaffRequestDto,
    createdByUserId: bigint,
    ipAddress: string,
    userAgent: string,
  ) {
    // Validation: only Super Admin can create staff accounts
    const creator = await this.prisma.user.findUnique({
      where: { id: createdByUserId },
      select: { role: true, deletedAt: true },
    });
    if (!creator || creator.deletedAt) {
      throw new UnauthorizedException('User not found');
    }
    if (creator.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can create Admin accounts.');
    }

    // Validation: only ADMIN can be assigned
    if (!STAFF_REGISTER_ALLOWED_ROLES.includes(dto.role)) {
      throw new BadRequestException(
        'Only ADMIN accounts can be created. USER and SUPER_ADMIN are not allowed.',
      );
    }

    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Password and confirm password do not match');
    }

    await this.assertUserUniqueness({
      email: dto.email,
      phoneNo: dto.phoneNo ?? null,
    });

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          address: dto.address,
          phoneNo: dto.phoneNo,
          role: dto.role,
          status: UserStatus.ACTIVE,
          lastLoginIp: ipAddress,
        },
      });

      await logAudit(tx, {
        userId: user.id,
        action: 'STAFF_REGISTERED',
        entity: 'User',
        entityId: user.id.toString(),
        ipAddress,
        userAgent,
        riskLevel: RiskLevel.LOW,
        metadata: { createdByUserId: createdByUserId.toString(), role: dto.role },
      });

      return user;
    });

    try {
      await this.notificationsService.create({
        userId: newUser.id,
        type: NotificationType.SYSTEM,
        title: 'Welcome to Classifieds (Staff)',
        message: `Hi ${newUser.fullName}, your staff account has been created with role ${newUser.role}.`,
        data: { email: newUser.email, role: newUser.role },
      });
    } catch (error) {
      this.logger.error(`Failed to create welcome notification for staff ${newUser.id}`, error);
    }

    return {
      message: 'Staff registered successfully.',
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
    };
  }


  async login(dto: LoginRequestDto, ipAddress: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || user.deletedAt) {
      await bcrypt.compare('dummy_password', DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.BANNED) throw new ForbiddenException('Account has been banned');
    if (user.status === UserStatus.SUSPENDED) throw new ForbiddenException('Account suspended');

    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      throw new ForbiddenException('Account is temporarily locked due to many failed attempts.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash || '');
    if (!isMatch) {
      await this.handleFailedLogin(user, ipAddress, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.handleSuccessfulLogin(user, ipAddress, userAgent);

    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    const session = await this.prisma.$transaction(async (tx) => {
      const activeCount = await tx.userSession.count({
        where: { userId: user.id, expiresAt: { gt: now } },
      });
      if (activeCount >= this.MAX_SESSIONS_PER_USER) {
        const oldest = await tx.userSession.findFirst({
          where: { userId: user.id },
          orderBy: { lastActiveAt: 'asc' },
        });
        if (oldest) {
          await tx.userSession.delete({ where: { id: oldest.id } });
          await logAudit(tx, {
            userId: user.id,
            action: 'SESSION_EVICTED',
            entity: 'UserSession',
            entityId: oldest.id.toString(),
            ipAddress,
            userAgent,
            riskLevel: RiskLevel.LOW,
            metadata: { reason: 'Max sessions reached (LRU eviction)' },
          });
          this.logger.log(`Session evicted for user ${user.id} (LRU)`);
        }
      }

      return tx.userSession.create({
        data: {
          userId: user.id,
          refreshTokenHash: 'pending',
          ipAddress,
          userAgent,
          lastActiveAt: now,
          expiresAt,
        },
      });
    });

    const { refreshToken } = await this.generateRefreshToken(user, session.id);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { refreshTokenHash: tokenHash },
    });

    const accessToken = await this.generateAccessToken(user, session.id);

    await this.prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        userId: user.id,
        action: 'SESSION_CREATED',
        entity: 'UserSession',
        entityId: session.id.toString(),
        ipAddress,
        userAgent,
        riskLevel: RiskLevel.LOW,
      });
    });

    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
    };
  }

  private async handleSuccessfulLogin(user: User, ip: string, agent: string) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        accountLockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        userId: user.id,
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: user.id.toString(),
        ipAddress: ip,
        userAgent: agent,
        riskLevel: RiskLevel.LOW,
      });
    });

    try {
      await this.notificationsService.create({
        userId: user.id,
        type: NotificationType.ACCOUNT,
        title: 'New Login Detected',
        message: `You have successfully logged in from IP: ${ip}`,
        data: { ip, agent: agent.substring(0, 50) }
      });
    } catch (error) {
      this.logger.error(`Failed to create login notification for user ${user.id}`, error);
    }
  }

  async logout(userId: bigint, sessionId: bigint, ipAddress: string, userAgent: string) {
    const deleted = await this.prisma.userSession.deleteMany({
      where: { id: sessionId, userId },
    });

    if (deleted.count > 0) {
      await this.prisma.$transaction(async (tx) => {
        await logAudit(tx, {
          userId,
          action: 'SESSION_REVOKED',
          entity: 'UserSession',
          entityId: sessionId.toString(),
          ipAddress,
          userAgent,
          riskLevel: RiskLevel.LOW,
        });
      });
    }

    try {
      await this.notificationsService.create({
        userId,
        type: NotificationType.ACCOUNT,
        title: 'Logged Out',
        message: 'You have been successfully logged out from your account.',
      });
    } catch (error) {
      this.logger.error('Failed to create logout notification', error);
    }

    return { message: 'Logged out successfully' };
  }

  /**
   * Refresh access token using a valid refresh token (session-based)
   */
  async refreshToken(dto: RefreshTokenRequestDto, ipAddress: string, userAgent: string) {
    try {
      const payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.configService.getOrThrow('jwt.refreshSecret'),
        issuer: this.configService.get<string>('jwt.issuer', 'classifieds-api'),
        audience: this.configService.get<string>('jwt.audience', 'classifieds-client'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const userId = BigInt(payload.sub);
      const sessionId = payload.sessionId ? BigInt(payload.sessionId) : null;

      if (!sessionId) {
        throw new UnauthorizedException('Invalid refresh token - missing session');
      }

      const session = await this.prisma.userSession.findFirst({
        where: { id: sessionId, userId },
        include: { user: true },
      });

      if (!session || !session.user) {
        throw new UnauthorizedException('Session not found');
      }

      const user = session.user;
      if (user.deletedAt) {
        throw new UnauthorizedException('User not found');
      }

      if (user.status === UserStatus.BANNED) {
        throw new ForbiddenException('Account has been banned');
      }

      if (user.status === UserStatus.SUSPENDED) {
        throw new ForbiddenException('Account suspended');
      }

      if (session.expiresAt < new Date()) {
        await this.prisma.userSession.delete({ where: { id: sessionId } });
        throw new UnauthorizedException('Refresh token has expired');
      }

      const tokenHash = crypto.createHash('sha256').update(dto.refreshToken).digest('hex');
      if (tokenHash !== session.refreshTokenHash) {
        this.logger.warn(`Refresh token reuse detected for user ${userId}`);
        await this.revokeAllUserSessions(userId);
        throw new UnauthorizedException('Invalid refresh token - all sessions revoked');
      }

      const now = new Date();
      await this.prisma.userSession.update({
        where: { id: sessionId },
        data: { lastActiveAt: now },
      });

      const { refreshToken: newRefreshToken } = await this.generateRefreshToken(user, sessionId);
      const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
      await this.prisma.userSession.update({
        where: { id: sessionId },
        data: { refreshTokenHash: newTokenHash },
      });

      const newAccessToken = await this.generateAccessToken(user, sessionId);

      await this.prisma.$transaction(async (tx) => {
        await logAudit(tx, {
          userId,
          action: 'TOKEN_REFRESHED',
          entity: 'UserSession',
          entityId: sessionId.toString(),
          ipAddress,
          userAgent,
          riskLevel: RiskLevel.LOW,
        });
      });

      this.logger.log(`Token refreshed for user ${userId}`);

      return {
        message: 'Token refreshed successfully',
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error('Token refresh failed', error);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Revoke all sessions for a user (e.g. token reuse / theft detection)
   */
  private async revokeAllUserSessions(userId: bigint) {
    await this.prisma.userSession.deleteMany({ where: { userId } });

    await this.prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        userId,
        action: 'ALL_SESSIONS_REVOKED',
        entity: 'User',
        entityId: userId.toString(),
        ipAddress: '',
        riskLevel: RiskLevel.HIGH,
        metadata: { reason: 'Possible token theft detected' },
      });
    });
  }

  async changePassword(userId: bigint, dto: ChangePasswordRequestDto, ipAddress: string, userAgent: string) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User not found');
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash || '');
    if (!isMatch) {
      throw new BadRequestException('Invalid old password');
    }

    const newHash = await bcrypt.hash(dto.newPassword, this.BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          passwordChangedAt: new Date(),
        },
      });
      await tx.userSession.deleteMany({ where: { userId } });

      await logAudit(tx, {
        userId,
        action: 'PASSWORD_CHANGED',
        entity: 'User',
        entityId: userId.toString(),
        ipAddress,
        userAgent,
        riskLevel: RiskLevel.HIGH,
      });
    });

    try {
      await this.notificationsService.create({
        userId,
        type: NotificationType.SECURITY,
        title: 'Security Alert: Password Changed',
        message: 'Your account password was recently changed. If this was not you, please contact support.',
        data: { ip: ipAddress }
      });
    } catch (error) {
      this.logger.error('Failed to create password change notification', error);
    }

    await this.cache.del(`user:profile:${userId}`);

    return { message: 'Password changed successfully' };
  }

  async resetPassword(dto: ResetPasswordRequestDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.passwordResetOtpHash || !user.passwordResetExpires) {
      throw new BadRequestException('Invalid request or OTP expired');
    }

    if (new Date() > user.passwordResetExpires) {
      throw new BadRequestException('OTP has expired');
    }

    const isOtpValid = await bcrypt.compare(dto.otp, user.passwordResetOtpHash);
    if (!isOtpValid) {
      throw new BadRequestException('Invalid OTP code');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, this.BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          passwordResetOtpHash: null,
          passwordResetExpires: null,
          passwordChangedAt: new Date(),
        },
      });
      await tx.userSession.deleteMany({ where: { userId: user.id } });

      await logAudit(tx, {
        userId: user.id,
        action: 'PASSWORD_RESET_SUCCESS',
        entity: 'User',
        entityId: user.id.toString(),
        ipAddress: '',
        riskLevel: RiskLevel.HIGH,
      });
    });

    try {
      await this.notificationsService.create({
        userId: user.id,
        type: NotificationType.SECURITY,
        title: 'Password Reset Successful',
        message: 'Your password has been successfully reset using the OTP.',
        data: { email: user.email }
      });
    } catch (error) {
      this.logger.error('Failed to create reset password notification', error);
    }

    await this.cache.del(`user:profile:${user.id}`);

    return { message: 'Password reset successfully' };
  }


  // HELPERS

  private async handleFailedLogin(user: User, ip: string, agent: string) {
    // Check if failed login count should be reset (last attempt was more than FAILED_LOGIN_RESET_TIME ago)
    const lastFailedAttempt = user.updatedAt;
    const timeSinceLastAttempt = Date.now() - lastFailedAttempt.getTime();

    // Reset count if enough time has passed since last failed attempt
    const currentCount = timeSinceLastAttempt > this.FAILED_LOGIN_RESET_TIME ? 0 : user.failedLoginCount;
    const newCount = currentCount + 1;
    let lockUntil = null;

    if (newCount >= this.MAX_LOGIN_ATTEMPTS) {
      lockUntil = new Date(Date.now() + this.ACCOUNT_LOCK_DURATION);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: newCount, accountLockedUntil: lockUntil },
    });

    await this.prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        userId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id.toString(),
        ipAddress: ip,
        userAgent: agent,
        riskLevel: RiskLevel.MEDIUM,
        metadata: { reason: 'Invalid Password', attempt: newCount },
      });
    });
  }

  private async generateAccessToken(user: User, sessionId: bigint): Promise<string> {
    const payload = {
      sub: user.id.toString(),
      sessionId: sessionId.toString(),
      email: user.email,
      role: user.role,
      type: 'access' as const,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn'),
      issuer: this.configService.get<string>('jwt.issuer', 'classifieds-api'),
      audience: this.configService.get<string>('jwt.audience', 'classifieds-client'),
    });
  }

  /**
   * Generate a refresh token (session-based; hash stored in UserSession)
   */
  private async generateRefreshToken(user: User, sessionId: bigint): Promise<{ refreshToken: string; expiresAt: Date }> {
    const payload = {
      sub: user.id.toString(),
      sessionId: sessionId.toString(),
      type: 'refresh' as const,
      jti: crypto.randomUUID(),
    };

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn', '7d'),
      issuer: this.configService.get<string>('jwt.issuer', 'classifieds-api'),
      audience: this.configService.get<string>('jwt.audience', 'classifieds-client'),
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    return { refreshToken, expiresAt };
  }

  async forgotPassword(dto: ForgotPasswordRequestDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || user.status === UserStatus.DELETED || user.status === UserStatus.BANNED) {
      return { message: 'If this email exists, an OTP has been sent.' };
    }

    // Check password reset rate limit (max attempts within expiry window)
    const recentResetAttempts = await this.prisma.auditLog.count({
      where: {
        userId: user.id,
        action: 'FORGOT_PASSWORD_REQUEST',
        createdAt: { gte: new Date(Date.now() - this.PASSWORD_RESET_TOKEN_EXPIRY) },
      },
    });

    if (recentResetAttempts >= this.PASSWORD_RESET_MAX_ATTEMPTS) {
      this.logger.warn(`Password reset rate limit exceeded for user ${user.id}`);
      return { message: 'If this email exists, an OTP has been sent.' }; // Don't reveal rate limit
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + this.PASSWORD_RESET_TOKEN_EXPIRY);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetOtpHash: otpHash,
        passwordResetExpires: expiresAt,
      },
    });

    this.logger.log(`[Password Reset OTP] Generated for ${user.email}: ${otp}`);

    await this.prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        userId: user.id,
        action: 'FORGOT_PASSWORD_REQUEST',
        entity: 'User',
        entityId: user.id.toString(),
        ipAddress: '',
        riskLevel: RiskLevel.LOW,
      });
    });

    return { message: 'If this email exists, an OTP has been sent.' };
  }

  /**
   * Send email verification OTP. No database save or check.
   * Generates 4-digit OTP, sends to email, returns a single token (payload + HMAC) for later verification.
   * Token encodes email and expiresAt so verify request body only needs { otp, token }.
   */
  async sendEmailVerifyOtp(email: string) {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAtMs = Date.now() + EMAIL_VERIFY_OTP_EXPIRY_MS;
    const expiresAt = String(expiresAtMs);

    this.logger.log(`[Email Verification OTP] Generated for ${email}: ${otp}`);

    const secret = this.configService.getOrThrow<string>('jwt.secret');
    const payload = Buffer.from(JSON.stringify({ email, expiresAt }), 'utf8').toString('base64url');
    const hmac = crypto.createHmac('sha256', secret).update(`${email}:${otp}:${expiresAt}`).digest('hex');
    const token = `${payload}.${hmac}`;

    return {
      message: 'Verification code sent to your email',
      token,
    };
  }

  /**
   * Verify email OTP using token from send-otp response.
   * Request body: { otp, token } only. Token contains email and expiresAt (payload.hmac).
   */
  async verifyEmailOtp(otp: string, token: string) {
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid verification token.');
    }
    let payload: { email: string; expiresAt: string };
    try {
      payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid verification token.');
    }
    const { email, expiresAt } = payload;
    if (!email || !expiresAt) {
      throw new BadRequestException('Invalid verification token.');
    }

    const expiresAtMs = parseInt(expiresAt, 10);
    if (Number.isNaN(expiresAtMs) || Date.now() > expiresAtMs) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    const secret = this.configService.getOrThrow<string>('jwt.secret');
    const expectedHmac = crypto.createHmac('sha256', secret).update(`${email}:${otp}:${expiresAt}`).digest('hex');
    const receivedHmac = parts[1];
    const expectedBuf = Buffer.from(expectedHmac, 'hex');
    const receivedBuf = Buffer.from(receivedHmac, 'hex');
    if (expectedBuf.length !== receivedBuf.length || expectedBuf.length !== 32 || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      throw new BadRequestException('Invalid verification code or token.');
    }

    return {
      message: 'Email verified successfully',
      verified: true,
    };
  }

  async getSessions(userId: bigint) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
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
      message: 'Sessions retrieved',
      sessions: sessions.map((s) => ({
        id: s.id.toString(),
        deviceName: s.deviceName,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
      })),
    };
  }

  async revokeSession(userId: bigint, idOrUuid: string, ipAddress: string, userAgent: string) {
    const where: { userId: bigint; id?: bigint; uuid?: string } = { userId };
    const trimmed = idOrUuid.trim();

    if (isUuid(trimmed)) where.uuid = trimmed;
    else if (/^\d+$/.test(trimmed)) where.id = BigInt(trimmed);
    else throw new NotFoundException('Session not found');

    const session = await this.prisma.userSession.findFirst({
      where,
      select: { id: true }
    });

    if (!session) throw new NotFoundException('Session not found');

    const deleted = await this.prisma.userSession.deleteMany({
      where: { id: session.id, userId },
    });

    if (deleted.count > 0) {
      await this.prisma.$transaction(async (tx) => {
        await logAudit(tx, {
          userId,
          action: 'SESSION_REVOKED',
          entity: 'UserSession',
          entityId: session.id.toString(),
          ipAddress,
          userAgent,
          riskLevel: RiskLevel.LOW,
          metadata: { reason: 'User revoked specific session' },
        });
      });
    }

    return {
      message: deleted.count > 0 ? 'Session revoked successfully' : 'Session not found',
      ...(deleted.count > 0 && { sessionId: session.id.toString() }),
    };
  }

  async logoutAll(userId: bigint, ipAddress: string, userAgent: string) {
    const deleted = await this.prisma.userSession.deleteMany({ where: { userId } });

    await this.prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        userId,
        action: 'ALL_SESSIONS_REVOKED',
        entity: 'User',
        entityId: userId.toString(),
        ipAddress,
        userAgent,
        riskLevel: RiskLevel.HIGH,
        metadata: { reason: 'User requested logout all devices' },
      });
    });

    return {
      message: `Logged out from ${deleted.count} device(s) successfully`,
      revokedCount: deleted.count,
    };
  }

  async getProfile(userId: bigint) {
    const cacheKey = `user:profile:${userId}`;
    const cached = await this.cache.get<{ message: string; user: AuthUserResponseDto }>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: getProfile(${userId})`);
      return cached;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User not found');
    }
    const result = {
      message: 'Profile retrieved',
      user: plainToInstance(AuthUserResponseDto, user, { excludeExtraneousValues: true })
    };

    await this.cache.set(cacheKey, result, 900); // 15 min TTL
    return result;
  }
}