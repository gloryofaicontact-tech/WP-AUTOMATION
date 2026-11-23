import { Expose } from 'class-transformer';
import { UserRole, UserStatus } from '@prisma/client';

export class AuthUserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  email!: string;

  @Expose()
  fullName!: string;

  @Expose()
  profileImage?: string;

  @Expose()
  role!: UserRole;

  @Expose()
  status!: UserStatus;

  @Expose()
  emailVerifiedAt?: Date;

  @Expose()
  lastLoginAt?: Date;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
