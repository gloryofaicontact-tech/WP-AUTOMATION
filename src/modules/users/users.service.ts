import { Injectable, ConflictException, BadRequestException, Logger } from '@nestjs/common';
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
  ) { }

  async updateProfile(userId: bigint, dto: UpdateProfileRequestDto) {
    // Check phoneNo uniqueness only if it's being updated and has a value
    if (dto.phoneNo !== undefined && dto.phoneNo !== null && dto.phoneNo !== '') {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          phoneNo: dto.phoneNo,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        throw new ConflictException('Phone number is already in use by another account');
      }
    }

    // Build update data object, only including fields that are actually provided (not undefined)
    // Empty strings are converted to null to clear the field
    const updateData: Record<string, any> = {};
    
    if (dto.fullName !== undefined) {
      updateData.fullName = dto.fullName || null;
    }
    if (dto.address !== undefined) {
      updateData.address = dto.address || null;
    }
    if (dto.phoneNo !== undefined) {
      updateData.phoneNo = dto.phoneNo || null;
    }
    if (dto.profileImage !== undefined) {
      updateData.profileImage = dto.profileImage || null;
    }

    // If no fields are provided, return current user without updating
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
        userId: userId,
        type: NotificationType.ACCOUNT,
        title: 'Profile Updated',
        message: 'Your profile information has been successfully updated.',
        data: { updatedFields: Object.keys(dto) }
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

  async deleteAccount(userId: bigint) {
    await this.prisma.$transaction(async (tx) => {
      await tx.userSession.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.DELETED,
          deletedAt: new Date(),
          deletedBy: userId,
        },
      });
    });

    try {
      await this.notificationsService.create({
        userId: userId,
        type: NotificationType.SECURITY,
        title: 'Account Deactivated',
        message: 'Your account has been marked for deletion as per your request.',
      });
    } catch (error) {
      this.logger.error(`Failed to send account deletion notification to user ${userId}`, error);
    }

    await this.cache.del(`user:profile:${userId}`);

    return { message: 'Account deleted successfully' };
  }
}