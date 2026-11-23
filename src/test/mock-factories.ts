import { UserRole, UserStatus, NotificationType, RiskLevel } from '@prisma/client';

// ============================================================================
// USER FACTORY
// ============================================================================

let userIdCounter = 1n;

export interface MockUserOptions {
    id?: bigint;
    email?: string;
    fullName?: string;
    address?: string | null;
    phoneNo?: string | null;
    profileImage?: string | null;
    role?: UserRole;
    status?: UserStatus;
    passwordHash?: string;
    failedLoginCount?: number;
    accountLockedUntil?: Date | null;
    deletedAt?: Date | null;
    lastLoginAt?: Date | null;
    lastLoginIp?: string | null;
    lastLogoutAt?: Date | null;
    passwordChangedAt?: Date | null;
    passwordResetOtpHash?: string | null;
    passwordResetExpires?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export const createMockUser = (options: MockUserOptions = {}) => {
    const id = options.id ?? userIdCounter++;
    return {
        id,
        email: options.email ?? `user${id}@test.com`,
        fullName: options.fullName ?? 'Test User',
        address: options.address ?? null,
        phoneNo: options.phoneNo ?? `+1234567890${id}`,
        profileImage: options.profileImage ?? null,
        role: options.role ?? UserRole.USER,
        status: options.status ?? UserStatus.ACTIVE,
        passwordHash: options.passwordHash ?? '$2b$12$hashedpassword',
        failedLoginCount: options.failedLoginCount ?? 0,
        accountLockedUntil: options.accountLockedUntil ?? null,
        deletedAt: options.deletedAt ?? null,
        lastLoginAt: options.lastLoginAt ?? null,
        lastLoginIp: options.lastLoginIp ?? null,
        lastLogoutAt: options.lastLogoutAt ?? null,
        passwordChangedAt: options.passwordChangedAt ?? null,
        passwordResetOtpHash: options.passwordResetOtpHash ?? null,
        passwordResetExpires: options.passwordResetExpires ?? null,
        createdAt: options.createdAt ?? new Date(),
        updatedAt: options.updatedAt ?? new Date(),
    };
};

export const resetUserIdCounter = () => {
    userIdCounter = 1n;
};

// ============================================================================
// NOTIFICATION FACTORY
// ============================================================================

let notificationIdCounter = 1n;

export interface MockNotificationOptions {
    id?: bigint;
    userId?: bigint;
    type?: NotificationType;
    title?: string;
    message?: string;
    data?: any;
    isRead?: boolean;
    createdAt?: Date;
    deletedAt?: Date | null;
}

export const createMockNotification = (options: MockNotificationOptions = {}) => {
    const id = options.id ?? notificationIdCounter++;
    return {
        id,
        userId: options.userId ?? 1n,
        type: options.type ?? NotificationType.SYSTEM,
        title: options.title ?? 'Test Notification',
        message: options.message ?? 'This is a test notification',
        data: options.data ?? null,
        isRead: options.isRead ?? false,
        createdAt: options.createdAt ?? new Date(),
        deletedAt: options.deletedAt ?? null,
    };
};

export const resetNotificationIdCounter = () => {
    notificationIdCounter = 1n;
};

// ============================================================================
// AUDIT LOG FACTORY
// ============================================================================

let auditLogIdCounter = 1n;

export interface MockAuditLogOptions {
    id?: bigint;
    userId?: bigint | null;
    action?: string;
    entity?: string | null;
    entityId?: string | null;
    riskLevel?: RiskLevel;
    createdAt?: Date;
}

export const createMockAuditLog = (options: MockAuditLogOptions = {}) => {
    const id = options.id ?? auditLogIdCounter++;
    return {
        id,
        userId: options.userId ?? 1n,
        uuid: `audit-uuid-${id}`,
        action: options.action ?? 'USER_LOGIN',
        entity: options.entity ?? 'User',
        entityId: options.entityId ?? '1',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Test',
        riskLevel: options.riskLevel ?? RiskLevel.LOW,
        flagged: false,
        createdAt: options.createdAt ?? new Date(),
    };
};

export const resetAuditLogIdCounter = () => {
    auditLogIdCounter = 1n;
};

export const resetAllCounters = () => {
    resetUserIdCounter();
    resetNotificationIdCounter();
    resetAuditLogIdCounter();
};

