import { Expose } from 'class-transformer';
import { UserRole, UserStatus } from '@prisma/client';

export class UpdateUserResponseDto {
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
  createdAt!: Date;
}
