import { UserRole, UserStatus } from '@prisma/client';

export interface UserProfileUpdatePayload {
  fullName?: string;
  profileImage?: string;
}

export interface UserStatusTransitions {
  [UserStatus.INVITED]: UserStatus[];
  [UserStatus.ACTIVE]: UserStatus[];
  [UserStatus.SUSPENDED]: UserStatus[];
}

export interface UserAccountDeletionResult {
  message: string;
  userId: string;
}
