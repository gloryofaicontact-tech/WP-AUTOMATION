import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RequestUser } from '../../common/interfaces/request-user.interface';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  /**
   * Creates a new personal MCP/API key and returns the raw key once.
   */
  async create(userId: string, name: string) {
    const secret = randomBytes(24).toString('hex');
    const rawKey = `wpa_live_${secret}`;
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = `${rawKey.slice(0, 13)}••••••${rawKey.slice(-4)}`;

    const record = await this.prisma.apiKey.create({
      data: {
        userId,
        name: name.trim(),
        keyPrefix,
        keyHash,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return {
      ...record,
      key: rawKey,
    };
  }

  /**
   * Lists all active (non-revoked) keys for a user.
   */
  async findAll(userId: string) {
    return this.prisma.apiKey.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Revokes a user's API key.
   */
  async revoke(id: string, userId: string) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, userId, revokedAt: null },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('API key not found or already revoked.');
    }

    await this.prisma.apiKey.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    return { success: true, id: existing.id };
  }

  /**
   * Validates a raw `wpa_live_...` Bearer token and returns the owning RequestUser.
   */
  async validateRawKey(rawKey: string): Promise<RequestUser | null> {
    if (!rawKey || !rawKey.startsWith('wpa_live_')) {
      return null;
    }

    const keyHash = this.hashKey(rawKey);
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!apiKey || apiKey.revokedAt || !apiKey.user) {
      return null;
    }

    // Update lastUsedAt asynchronously without blocking request
    this.prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    return {
      id: apiKey.user.id,
      sub: apiKey.user.id,
      email: apiKey.user.email,
      fullName: apiKey.user.fullName,
      role: apiKey.user.role,
      status: apiKey.user.status,
    };
  }
}
