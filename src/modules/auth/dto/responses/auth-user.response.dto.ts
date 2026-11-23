import { Expose, Transform } from 'class-transformer';
import { UserRole, UserStatus } from '@prisma/client';

export class AuthUserResponseDto {
  @Expose()
  @Transform(({ value }) => value.toString(), { toPlainOnly: true })
  id!: string;

  @Expose()
  uuid!: string;

  @Expose()
  email!: string;

  @Expose()
  fullName!: string;

  @Expose()
  address?: string;

  @Expose()
  phoneNo?: string;

  @Expose()
  role!: UserRole;

  @Expose()
  status!: UserStatus;

  @Expose()
  createdAt!: Date;
}