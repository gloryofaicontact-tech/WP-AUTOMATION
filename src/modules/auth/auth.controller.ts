import { Controller, Post, Body, HttpCode, HttpStatus, Ip, Req, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RegisterRequestDto } from './dto/requests/register.request.dto';
import { RegisterStaffRequestDto } from './dto/requests/register-staff.request.dto';
import { LoginRequestDto } from './dto/requests/login.request.dto';
import { ChangePasswordRequestDto } from './dto/requests/change-password.request.dto';
import { ForgotPasswordRequestDto } from './dto/requests/forgot-password.request.dto';
import { ResetPasswordRequestDto } from './dto/requests/reset-password.request.dto';
import { RefreshTokenRequestDto } from './dto/requests/refresh-token.request.dto';
import { EmailVerifySendRequestDto } from './dto/requests/email-verify-send.request.dto';
import { EmailVerifyCheckRequestDto } from './dto/requests/email-verify-check.request.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-register': {} })
  async register(
    @Body() dto: RegisterRequestDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.register(dto, ipAddress, userAgent);
  }

  @Post('register/staff')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async registerStaff(
    @Body() dto: RegisterStaffRequestDto,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.registerStaff(
      dto,
      BigInt(user.sub || user.id),
      ipAddress,
      userAgent,
    );
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-sensitive': {} })
  async login(
    @Body() dto: LoginRequestDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const sessionId = user.sessionId ? BigInt(user.sessionId) : null;
    if (!sessionId) {
      return { message: 'Logged out successfully' };
    }
    return this.authService.logout(BigInt(user.sub || user.id), sessionId, ipAddress, userAgent);
  }


  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-refresh': {} })
  async refreshToken(
    @Body() dto: RefreshTokenRequestDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.refreshToken(dto, ipAddress, userAgent);
  }

  @Get('details')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: RequestUser) {
    return this.authService.getProfile(BigInt(user.sub || user.id));
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getSessions(@CurrentUser() user: RequestUser) {
    return this.authService.getSessions(BigInt(user.sub || user.id));
  }

  @Delete('sessions/revoke/:idOrUuid')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @CurrentUser() user: RequestUser,
    @Param('idOrUuid') idOrUuid: string,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.revokeSession(
      BigInt(user.sub || user.id),
      idOrUuid,
      ipAddress,
      userAgent,
    );
  }

  @Post('sessions/revoke-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.logoutAll(BigInt(user.sub || user.id), ipAddress, userAgent);
  }

  @Post('change-password')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ 'auth-sensitive': {} })
  async changePassword(@CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordRequestDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.changePassword(BigInt(user.sub || user.id), dto, ipAddress, userAgent);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-sensitive': {} })
  async forgotPassword(@Body() dto: ForgotPasswordRequestDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-sensitive': {} })
  async resetPassword(@Body() dto: ResetPasswordRequestDto) {
    return this.authService.resetPassword(dto);
  }

  /** Send email verification OTP. No database save. Returns hashed token + expiresAt. */
  @Public()
  @Post('email-verify/send')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-sensitive': {} })
  async sendEmailVerifyOtp(@Body() dto: EmailVerifySendRequestDto) {
    return this.authService.sendEmailVerifyOtp(dto.email);
  }

  /** Verify email OTP using token from send response. No database check. */
  @Public()
  @Post('email-verify/check')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-sensitive': {} })
  async verifyEmailOtp(@Body() dto: EmailVerifyCheckRequestDto) {
    return this.authService.verifyEmailOtp(dto.otp, dto.token);
  }
}