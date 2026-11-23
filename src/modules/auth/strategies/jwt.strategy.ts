import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { RequestUser } from '../../../common/interfaces/request-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
      issuer: configService.get<string>('jwt.issuer', 'classifieds-api'),
      audience: configService.get<string>('jwt.audience', 'classifieds-client'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access') {
      this.logger.warn(`Invalid token type: ${payload.type}`);
      throw new UnauthorizedException('Invalid token type');
    }

    if (!payload.sessionId) {
      this.logger.warn('Access token missing sessionId - re-login required');
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    const sessionId = BigInt(payload.sessionId);
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId: BigInt(payload.sub), expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!session || !session.user) {
      this.logger.warn(`Session not found or expired: ${sessionId}`);
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    const user = session.user;
    if (user.deletedAt) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      this.logger.warn(`Inactive account: ${user.id} (Status: ${user.status})`);
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);
    }

    this.prisma.userSession
      .update({ where: { id: sessionId }, data: { lastActiveAt: new Date() } })
      .catch((error) => this.logger.error('Failed to update lastActiveAt', error));

    const requestUser: RequestUser = {
      id: user.id.toString(),
      sub: user.id.toString(),
      sessionId: payload.sessionId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    };
    return requestUser;
  }
}

