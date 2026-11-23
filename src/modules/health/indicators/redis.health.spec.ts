import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisHealthIndicator } from './redis.health';
import { CacheService } from '../../../infrastructure/cache/cache.service';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let cacheService: jest.Mocked<CacheService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockCacheService = {
      isConnected: false,
      ping: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    indicator = module.get<RedisHealthIndicator>(RedisHealthIndicator);
    cacheService = module.get(CacheService);
    configService = module.get(ConfigService);
  });

  describe('isHealthy', () => {
    it('should return up status when Redis is disabled', async () => {
      configService.get.mockReturnValue(false); // REDIS_ENABLED = false

      const result = await indicator.isHealthy('redis');

      expect(result).toEqual({
        redis: {
          status: 'up',
          enabled: false,
          connected: false,
          message: 'Redis is disabled (REDIS_ENABLED=false)',
        },
      });
    });

    it('should return down status when Redis is enabled but not connected', async () => {
      configService.get.mockReturnValue(true); // REDIS_ENABLED = true
      (cacheService as any).isConnected = false;

      const result = await indicator.isHealthy('redis');

      expect(result).toEqual({
        redis: {
          status: 'down',
          enabled: true,
          connected: false,
          message: 'Redis connection is not established',
        },
      });
    });

    it('should return up status when Redis is enabled, connected, and ping succeeds', async () => {
      configService.get.mockReturnValue(true); // REDIS_ENABLED = true
      (cacheService as any).isConnected = true;
      cacheService.ping.mockResolvedValue(true);

      const result = await indicator.isHealthy('redis');

      expect(result).toEqual({
        redis: {
          status: 'up',
          enabled: true,
          connected: true,
          ping: true,
        },
      });
    });

    it('should return down status when Redis is enabled, connected, but ping fails', async () => {
      configService.get.mockReturnValue(true); // REDIS_ENABLED = true
      (cacheService as any).isConnected = true;
      cacheService.ping.mockResolvedValue(false);

      const result = await indicator.isHealthy('redis');

      expect(result).toEqual({
        redis: {
          status: 'down',
          enabled: true,
          connected: false,
          ping: false,
          message: 'Redis ping test failed',
        },
      });
    });

    it('should return down status when ping throws an error', async () => {
      configService.get.mockReturnValue(true); // REDIS_ENABLED = true
      (cacheService as any).isConnected = true;
      cacheService.ping.mockRejectedValue(new Error('Connection error'));

      const result = await indicator.isHealthy('redis');

      expect(result).toEqual({
        redis: {
          status: 'down',
          enabled: true,
          connected: false,
          ping: false,
          message: 'Connection error',
        },
      });
    });
  });
});
