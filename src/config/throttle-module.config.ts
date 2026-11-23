import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Factory for ThrottlerModule options.
 * Throttle applied only to auth endpoints; other APIs have no throttle.
 * In development, uses generous limits to avoid blocking active testing.
 * Skips throttling in test env to avoid e2e flakiness.
 */
export function getThrottlerModuleOptions(configService: ConfigService) {
  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
  const isDev = nodeEnv === 'development';
  const isTest = nodeEnv === 'test';

  const skipIf = (_context: ExecutionContext) => isTest;

  return {
    skipIf,
    throttlers: [
      {
        name: 'auth-sensitive',
        ttl: isDev ? 60000 : configService.get<number>('throttle.authSensitive.ttl', 900000),
        limit: isDev ? 100 : configService.get<number>('throttle.authSensitive.limit', 5),
      },
      {
        name: 'auth-refresh',
        ttl: isDev ? 60000 : configService.get<number>('throttle.authRefresh.ttl', 60000),
        limit: isDev ? 200 : configService.get<number>('throttle.authRefresh.limit', 10),
      },
      {
        name: 'auth-register',
        ttl: isDev ? 60000 : configService.get<number>('throttle.authRegister.ttl', 3600000),
        limit: isDev ? 50 : configService.get<number>('throttle.authRegister.limit', 3),
      },
    ],
  };
}
