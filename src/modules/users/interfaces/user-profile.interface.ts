/**
 * User module interfaces
 * 
 * Defines contracts and types for user profile operations and management.
 */

import { UserRole, UserStatus } from '@prisma/client';

/**
 * User profile update payload
 */
export interface UserProfileUpdatePayload {
  /** Full name */
  fullName?: string;
  /** Address */
  address?: string;
  /** Phone number */
  phoneNo?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Bio/description */
  bio?: string;
}

/**
 * User status transition map
 */
export interface UserStatusTransitions {
  [UserStatus.PENDING]: UserStatus[];
  [UserStatus.ACTIVE]: UserStatus[];
  [UserStatus.SUSPENDED]: UserStatus[];
  [UserStatus.BANNED]: UserStatus[];
  [UserStatus.DELETED]: UserStatus[];
}

/**
 * User account deletion result
 */
export interface UserAccountDeletionResult {
  /** Success message */
  message: string;
  /** User ID that was deleted */
  userId: bigint | string;
  /** Deletion timestamp */
  deletedAt: Date;
}

/**
 * User profile statistics
 */
export interface UserProfileStatistics {
  /** Total ads posted */
  totalAds: number;
  /** Active ads count */
  activeAds: number;
  /** Total favorites */
  totalFavorites: number;
  /** Shop ID (if user has a shop) */
  shopId?: bigint;
  /** Average rating as seller */
  sellerRating?: number;
  /** Total reviews received */
  reviewsCount: number;
}
