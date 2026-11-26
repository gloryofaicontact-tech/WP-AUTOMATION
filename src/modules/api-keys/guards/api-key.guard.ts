import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ApiKeysService } from '../api-keys.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

/**
 * Authenticates `/mcp` requests using either a Personal API Key (`wpa_live_...`)
 * or a valid JWT access token in the `Authorization: Bearer <token>` header.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string = req.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!token) {
      throw new UnauthorizedException(
        'Missing Authorization Bearer token. Generate an MCP key in Settings -> MCP Connect.',
      );
    }

    // 1. Check Personal API Key (`wpa_live_...`)
    if (token.startsWith('wpa_live_')) {
      const user = await this.apiKeysService.validateRawKey(token);
      if (!user) {
        throw new UnauthorizedException('Invalid or revoked MCP API key.');
      }
      req.user = user;
      return true;
    }

    // 2. Fallback: accept valid JWT access token
    try {
      const secret = this.configService.get<string>('jwt.secret') || process.env.JWT_SECRET;
      const payload = await this.jwtService.verifyAsync(token, { secret });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, fullName: true, role: true, status: true },
      });
      if (!user) {
        throw new UnauthorizedException('User not found.');
      }
      req.user = { ...user, sub: user.id };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired Bearer token.');
    }
  }
}
