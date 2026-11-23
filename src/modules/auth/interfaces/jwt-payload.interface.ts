import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  sessionId?: string;
  email?: string;
  role?: UserRole;
  type: 'access' | 'refresh';
  jti?: string;
  iat?: number;
  exp?: number;
}