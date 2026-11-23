import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { UpdateProfileRequestDto } from './dto/requests/update-profile.request.dto';
import { UserStatus, NotificationType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { UpdateUserResponseDto } from './dto/responses/update-user.response.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly cache: CacheService,
  ) {}

  async updateProfile(userId: string, dto: UpdateProfileRequestDto) {
    const updateData: Record<string, any> = {};

    if (dto.fullName !== undefined) {
      updateData.fullName = dto.fullName.trim();
    }
    if (dto.profileImage !== undefined) {
      updateData.profileImage = dto.profileImage || null;
    }

    if (Object.keys(updateData).length === 0) {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!currentUser) {
        throw new BadRequestException('User not found');
      }
      return {
        message: 'No fields to update',
        user: plainToInstance(UpdateUserResponseDto, currentUser, { excludeExtraneousValues: true }),
      };
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    try {
      await this.notificationsService.create({
        userId,
        type: NotificationType.SYSTEM,
        title: 'Profile Updated',
        message: 'Your profile information has been successfully updated.',
      });
    } catch (error) {
      this.logger.error(`Failed to send profile update notification to user ${userId}`, error);
    }

    await this.cache.del(`user:profile:${userId}`);

    return {
      message: 'Profile updated successfully',
      user: plainToInstance(UpdateUserResponseDto, updatedUser, { excludeExtraneousValues: true }),
    };
  }

  async deleteAccount(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.userSession.deleteMany({ where: { userId } });
      await tx.authToken.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.SUSPENDED,
        },
      });
    });

    try {
      await this.notificationsService.create({
        userId,
        type: NotificationType.SECURITY,
        title: 'Account Suspended',
        message: 'Your account has been deactivated as per your request.',
      });
    } catch (error) {
      this.logger.error(`Failed to create security notification for user ${userId}`, error);
    }

    await this.cache.del(`user:profile:${userId}`);

    return {
      message: 'Account deleted successfully',
      userId,
    };
  }
}
