import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { validateJwtSecrets } from './jwt-secrets.util';

describe('jwt-secrets.util', () => {
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let logger: jest.Mocked<Pick<Logger, 'warn' | 'error'>>;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    };
    logger = {
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  it('should not warn when secrets are strong and different (production)', () => {
    (configService.get as jest.Mock)
      .mockReturnValueOnce('production')
      .mockReturnValueOnce('a'.repeat(44))
      .mockReturnValueOnce('b'.repeat(44));

    expect(() => validateJwtSecrets(configService as unknown as ConfigService, logger as unknown as Logger)).not.toThrow();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should throw in production when JWT_SECRET is placeholder', () => {
    (configService.get as jest.Mock)
      .mockReturnValueOnce('production')
      .mockReturnValueOnce('super_secret_random_key_change_this_in_production_123')
      .mockReturnValueOnce('b'.repeat(44));

    expect(() => validateJwtSecrets(configService as unknown as ConfigService, logger as unknown as Logger)).toThrow(
      /insecure JWT secrets/,
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('should warn in development when secrets are placeholders', () => {
    (configService.get as jest.Mock)
      .mockReturnValueOnce('development')
      .mockReturnValueOnce('super_secret_key_123')
      .mockReturnValueOnce('different_refresh_456');

    validateJwtSecrets(configService as unknown as ConfigService, logger as unknown as Logger);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('[SECURITY]'));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
  });

  it('should throw in production when both secrets are the same', () => {
    const sameSecret = 'a'.repeat(44);
    (configService.get as jest.Mock)
      .mockReturnValueOnce('production')
      .mockReturnValueOnce(sameSecret)
      .mockReturnValueOnce(sameSecret);

    expect(() => validateJwtSecrets(configService as unknown as ConfigService, logger as unknown as Logger)).toThrow(
      /must be different/,
    );
  });
});
