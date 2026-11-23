/**
 * Notifications module interfaces
 * 
 * Defines contracts and types for notification operations, types, and priorities.
 */

import { NotificationType } from '@prisma/client';

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * Notification operation result
 */
export interface NotificationOperationResult {
  /** Success message */
  message: string;
  /** Number of notifications affected */
  count?: number;
}

/**
 * Notification creation payload
 */
export interface NotificationCreatePayload {
  /** User ID to notify */
  userId: bigint;
  /** Notification type */
  type: NotificationType;
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Optional link/action URL */
  actionUrl?: string;
  /** Priority level */
  priority?: NotificationPriority;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Notification filter criteria
 */
export interface NotificationFilterCriteria {
  /** Filter by type */
  type?: NotificationType;
  /** Filter by priority */
  priority?: NotificationPriority;
  /** Filter by read status */
  isRead?: boolean;
  /** Date range filter */
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

/**
 * Notification batch operation result
 */
export interface NotificationBatchResult {
  /** Number of notifications marked as read */
  markedAsRead: number;
  /** Number of notifications deleted */
  deleted: number;
  /** Total processed */
  total: number;
}
