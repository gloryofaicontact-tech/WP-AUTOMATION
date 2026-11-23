import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';

// ============================================================================
// MOCK PRISMA SERVICE
// ============================================================================

export type MockPrismaService = {
  user: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  auditLog: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
  notification: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    count: jest.Mock;
  };
  mainCategory: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  subCategory: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  country: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  district: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  city: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  ad: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
    aggregate: jest.Mock;
    groupBy: jest.Mock;
  };
  review: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
    aggregate: jest.Mock;
    groupBy: jest.Mock;
  };
  conversation: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  message: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  categoryAuditLog: {
    create: jest.Mock;
  };
  locationAuditLog: {
    create: jest.Mock;
  };
  $transaction: jest.Mock;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $queryRaw: jest.Mock;
};

export const createMockPrismaService = (): MockPrismaService => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  notification: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  mainCategory: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  subCategory: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  country: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  district: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  city: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  ad: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  review: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  conversation: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  message: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  categoryAuditLog: {
    create: jest.fn(),
  },
  locationAuditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback({
    user: { create: jest.fn(), update: jest.fn() },
    userSession: {
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 1n, expiresAt: new Date() }),
    },
    auditLog: { create: jest.fn() },
    categoryAuditLog: { create: jest.fn() },
    locationAuditLog: { create: jest.fn() },
    mainCategory: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    subCategory: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    country: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    district: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    city: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    ad: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    review: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    conversation: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    message: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn() },
    notification: { create: jest.fn() },
  })),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $queryRaw: jest.fn(),
});

// ============================================================================
// MOCK JWT SERVICE
// ============================================================================

export type MockJwtService = {
  signAsync: jest.Mock;
  verifyAsync: jest.Mock;
  sign: jest.Mock;
  verify: jest.Mock;
};

export const createMockJwtService = (): MockJwtService => ({
  signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
  verifyAsync: jest.fn().mockResolvedValue({ sub: '1', email: 'test@test.com' }),
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ sub: '1', email: 'test@test.com' }),
});

// ============================================================================
// MOCK CONFIG SERVICE
// ============================================================================

export type MockConfigService = {
  get: jest.Mock;
  getOrThrow: jest.Mock;
};

export const createMockConfigService = (overrides: Record<string, any> = {}): MockConfigService => {
  const defaults: Record<string, any> = {
    'security.lockout.maxLoginAttempts': 5,
    'security.lockout.lockDuration': 1800000,
    'security.bcryptRounds': 12,
    'jwt.secret': 'test-secret',
    'jwt.refreshSecret': 'test-refresh-secret',
    'jwt.expiresIn': '1h',
    'app.nodeEnv': 'test',
    ...overrides,
  };

  return {
    get: jest.fn((key: string, defaultValue?: any) => defaults[key] ?? defaultValue),
    getOrThrow: jest.fn((key: string) => {
      if (defaults[key] === undefined) {
        throw new Error(`Config key ${key} not found`);
      }
      return defaults[key];
    }),
  };
};

// ============================================================================
// MOCK NOTIFICATIONS SERVICE
// ============================================================================

export type MockNotificationsService = {
  create: jest.Mock;
  findAll: jest.Mock;
  markAsRead: jest.Mock;
  markAllAsRead: jest.Mock;
  remove: jest.Mock;
};

export const createMockNotificationsService = (): MockNotificationsService => ({
  create: jest.fn().mockResolvedValue({ id: 1n }),
  findAll: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
  markAsRead: jest.fn().mockResolvedValue({ message: 'Notification marked as read' }),
  markAllAsRead: jest.fn().mockResolvedValue({ message: 'All notifications marked as read' }),
  remove: jest.fn().mockResolvedValue({ message: 'Notification deleted successfully' }),
});

// ============================================================================
// MOCK REFLECTOR
// ============================================================================

export type MockReflector = {
  getAllAndOverride: jest.Mock;
  get: jest.Mock;
};

export const createMockReflector = (): MockReflector => ({
  getAllAndOverride: jest.fn(),
  get: jest.fn(),
});

// ============================================================================
// MOCK HTTP ADAPTER HOST
// ============================================================================

export const createMockHttpAdapterHost = () => ({
  httpAdapter: {
    getRequestUrl: jest.fn().mockReturnValue('/test-path'),
    reply: jest.fn(),
  },
});

// ============================================================================
// MOCK EXECUTION CONTEXT
// ============================================================================

export const createMockExecutionContext = (options: {
  user?: any;
  body?: any;
  params?: any;
  query?: any;
  headers?: Record<string, string>;
  ip?: string;
} = {}): ExecutionContext => {
  const mockRequest = {
    user: options.user ?? { sub: '1', email: 'test@test.com', role: UserRole.USER },
    body: options.body ?? {},
    params: options.params ?? {},
    query: options.query ?? {},
    headers: options.headers ?? { 'user-agent': 'test-agent' },
    ip: options.ip ?? '127.0.0.1',
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockRequest),
      getResponse: jest.fn().mockReturnValue(mockResponse),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
    getArgs: jest.fn().mockReturnValue([mockRequest, mockResponse]),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn().mockReturnValue('http'),
  } as unknown as ExecutionContext;
};

// ============================================================================
// MOCK ARGUMENT HOST (for filters)
// ============================================================================

export const createMockArgumentsHost = (options: {
  url?: string;
  method?: string;
} = {}) => {
  const mockRequest = {
    url: options.url ?? '/test',
    method: options.method ?? 'GET',
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockRequest),
      getResponse: jest.fn().mockReturnValue(mockResponse),
    }),
    getArgs: jest.fn().mockReturnValue([mockRequest, mockResponse]),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn().mockReturnValue('http'),
  };
};

// ============================================================================
// MOCK CALL HANDLER (for interceptors)
// ============================================================================

import { of } from 'rxjs';

export const createMockCallHandler = (returnValue: any = {}) => ({
  handle: jest.fn().mockReturnValue(of(returnValue)),
});
