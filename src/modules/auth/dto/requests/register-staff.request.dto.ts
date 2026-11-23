import { IsEmail, IsString, MinLength, MaxLength, Matches, IsNotEmpty, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '@prisma/client';

export const STAFF_REGISTER_ALLOWED_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.EDITOR,
  UserRole.REVIEWER,
];

export class RegisterStaffRequestDto {
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*\W).*$/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  password!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Confirm password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Confirm password must not exceed 128 characters' })
  confirmPassword!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  fullName!: string;

  @IsNotEmpty()
  @IsEnum(STAFF_REGISTER_ALLOWED_ROLES, {
    message: 'Role must be one of: ADMIN, EDITOR, REVIEWER',
  })
  role!: UserRole;
}
