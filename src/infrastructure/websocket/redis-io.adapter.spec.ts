import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisIoAdapter, createRedisAdapter } from './redis-io.adapter';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
});

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    duplicate: jest.fn().mockReturnThis(),
    on: jest.fn(),
  })),
}));

jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn().mockReturnValue('redis-adapter'),
}));

describe('RedisIoAdapter', () => {
  let adapter: RedisIoAdapter;
  let mockApp: jest.Mocked<INestApplication>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockApp = {
      getHttpServer: jest.fn().mockReturnValue({}),
    } as unknown as jest.Mocked<INestApplication>;

    mockConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;
  });

  describe('constructor', () => {
    it('should create adapter instance', () => {
      adapter = new RedisIoAdapter(mockApp, mockConfigService);

      expect(adapter).toBeInstanceOf(RedisIoAdapter);
    });
  });

  describe('connectToRedis', () => {
    it('should skip connection when redis is disabled', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'websocket.redis.enabled') return false;
        return defaultValue;
      });

      adapter = new RedisIoAdapter(mockApp, mockConfigService);
      await adapter.connectToRedis();

      const { createClient } = require('redis');
      expect(createClient).not.toHaveBeenCalled();
    });

    it('should connect to redis when enabled without password', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'websocket.redis.enabled': true,
          'websocket.redis.tls': false,
          'websocket.redis.host': 'localhost',
          'websocket.redis.port': 6379,
          'websocket.redis.password': undefined,
          'websocket.redis.db': 1,
          'websocket.redis.connectTimeout': 10000,
        };
        return config[key] ?? defaultValue;
      });

      adapter = new RedisIoAdapter(mockApp, mockConfigService);
      await adapter.connectToRedis();

      const { createClient } = require('redis');
      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'redis://localhost:6379/1',
          socket: expect.objectContaining({ connectTimeout: 10000 }),
        }),
      );
    });

    it('should connect to redis when enabled with password', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'websocket.redis.enabled': true,
          'websocket.redis.tls': false,
          'websocket.redis.host': 'redis-server',
          'websocket.redis.port': 6380,
          'websocket.redis.password': 'secret123',
          'websocket.redis.db': 2,
          'websocket.redis.connectTimeout': 10000,
        };
        return config[key] ?? defaultValue;
      });

      adapter = new RedisIoAdapter(mockApp, mockConfigService);
      await adapter.connectToRedis();

      const { createClient } = require('redis');
      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'redis://:secret123@redis-server:6380/2',
          socket: expect.objectContaining({ connectTimeout: 10000 }),
        }),
      );
    });

    it('should connect with TLS when websocket.redis.tls is true (e.g. AWS ElastiCache)', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'websocket.redis.enabled': true,
          'websocket.redis.tls': true,
          'websocket.redis.host': 'my-cluster.xxxxx.cache.amazonaws.com',
          'websocket.redis.port': 6380,
          'websocket.redis.password': 'auth-token',
          'websocket.redis.db': 1,
          'websocket.redis.connectTimeout': 10000,
        };
        return config[key] ?? defaultValue;
      });

      adapter = new RedisIoAdapter(mockApp, mockConfigService);
      await adapter.connectToRedis();

      const { createClient } = require('redis');
      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'rediss://:auth-token@my-cluster.xxxxx.cache.amazonaws.com:6380/1',
          socket: expect.objectContaining({ connectTimeout: 10000, tls: true }),
        }),
      );
    });

    it('should handle redis connection error gracefully', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'websocket.redis.enabled') return true;
        return defaultValue;
      });

      const { createClient } = require('redis');
      createClient.mockReturnValue({
        connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
        duplicate: jest.fn().mockReturnThis(),
        on: jest.fn(),
      });

      adapter = new RedisIoAdapter(mockApp, mockConfigService);
      await expect(adapter.connectToRedis()).resolves.not.toThrow();
    });

    it('should set up error handlers for pub/sub clients', async () => {
      const mockPubClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        duplicate: jest.fn(),
        on: jest.fn(),
      };
      const mockSubClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      };
      mockPubClient.duplicate.mockReturnValue(mockSubClient);

      const { createClient } = require('redis');
      createClient.mockReturnValue(mockPubClient);

      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'websocket.redis.enabled') return true;
        return defaultValue;
      });

      adapter = new RedisIoAdapter(mockApp, mockConfigService);
      await adapter.connectToRedis();

      expect(mockPubClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSubClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should log pub client errors', async () => {
      let pubErrorHandler: (err: Error) => void = () => {};
      let subErrorHandler: (err: Error) => void = () => {};

      const mockPubClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        duplicate: jest.fn(),
        on: jest.fn((event: string, handler: (err: Error) => void) => {
          if (event === 'error') pubErrorHandler = handler;
        }),
      };
      const mockSubClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn((event: string, handler: (err: Error) => void) => {
          if (event === 'error') subErrorHandler = handler;
        }),
      };
      mockPubClient.duplicate.mockReturnValue(mockSubClient);

      const { createClient } = require('redis');
      createClient.mockReturnValue(mockPubClient);

      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'websocket.redis.enabled') return true;
        return defaultValue;
      });

      adapter = new RedisIoAdapter(mockApp, mockConfigService);
      await adapter.connectToRedis();

      expect(() => pubErrorHandler(new Error('Pub error'))).not.toThrow();
      expect(() => subErrorHandler(new Error('Sub error'))).not.toThrow();
    });
  });

  describe('createIOServer', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'websocket.cors.origin': ['http://localhost:3000'],
          'websocket.pingTimeout': 30000,
          'websocket.pingInterval': 25000,
          'websocket.connectTimeout': 45000,
          'websocket.maxHttpBufferSize': 1048576,
        };
        return config[key] ?? defaultValue;
      });
    });

    it('should create server with in-memory adapter when redis not connected', () => {
      adapter = new RedisIoAdapter(mockApp, mockConfigService);

      const mockParentServer = {
        adapter: jest.fn(),
      };

      jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), 'createIOServer')
        .mockReturnValue(mockParentServer);

      const server = adapter.createIOServer(3000);

      expect(server).toBeDefined();
    });

    it('should create server with redis adapter when connected', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'websocket.redis.enabled') return true;
        const config: Record<string, unknown> = {
          'websocket.cors.origin': ['http://localhost:3000'],
          'websocket.pingTimeout': 30000,
          'websocket.pingInterval': 25000,
          'websocket.connectTimeout': 45000,
          'websocket.maxHttpBufferSize': 1048576,
        };
        return config[key] ?? defaultValue;
      });

      const mockPubClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        duplicate: jest.fn().mockReturnThis(),
        on: jest.fn(),
      };

      const { createClient } = require('redis');
      createClient.mockReturnValue(mockPubClient);

      adapter = new RedisIoAdapter(mockApp, mockConfigService);
      await adapter.connectToRedis();

      const mockServer = {
        adapter: jest.fn(),
      };

      const originalCreateIOServer = Object.getPrototypeOf(Object.getPrototypeOf(adapter)).createIOServer;
      jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), 'createIOServer')
        .mockReturnValue(mockServer);

      const server = adapter.createIOServer(3000);

      expect(mockServer.adapter).toHaveBeenCalledWith('redis-adapter');
    });

    it('should use default config values', () => {
      mockConfigService.get.mockReturnValue(undefined);

      adapter = new RedisIoAdapter(mockApp, mockConfigService);

      const mockServer = {
        adapter: jest.fn(),
      };

      jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), 'createIOServer')
        .mockReturnValue(mockServer);

      const server = adapter.createIOServer(3000);

      expect(server).toBeDefined();
    });
  });
});

describe('createRedisAdapter', () => {
  let mockApp: jest.Mocked<INestApplication>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockApp = {
      getHttpServer: jest.fn().mockReturnValue({}),
    } as unknown as jest.Mocked<INestApplication>;

    mockConfigService = {
      get: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<ConfigService>;
  });

  it('should create and initialize redis adapter', async () => {
    const adapter = await createRedisAdapter(mockApp, mockConfigService);

    expect(adapter).toBeInstanceOf(RedisIoAdapter);
  });

  it('should call connectToRedis during initialization', async () => {
    const connectSpy = jest.spyOn(RedisIoAdapter.prototype, 'connectToRedis')
      .mockResolvedValue(undefined);

    await createRedisAdapter(mockApp, mockConfigService);

    expect(connectSpy).toHaveBeenCalled();

    connectSpy.mockRestore();
  });
});

