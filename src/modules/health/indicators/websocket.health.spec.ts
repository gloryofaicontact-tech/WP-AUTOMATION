import { HealthCheckError } from '@nestjs/terminus';
import { WebSocketHealthIndicator, IWebSocketHealthProvider } from './websocket.health';

describe('WebSocketHealthIndicator', () => {
  let indicator: WebSocketHealthIndicator;
  let mockProvider: jest.Mocked<IWebSocketHealthProvider>;

  beforeEach(() => {
    indicator = new WebSocketHealthIndicator();

    mockProvider = {
      getConnectedUsersCount: jest.fn(),
      getTotalConnectionsCount: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setProvider', () => {
    it('should set the websocket provider', () => {
      indicator.setProvider(mockProvider);

      expect((indicator as any).wsProvider).toBe(mockProvider);
    });
  });

  describe('isHealthy', () => {
    it('should return not_initialized status when provider not set', async () => {
      const result = await indicator.isHealthy('websocket');

      expect(result.websocket).toMatchObject({
        status: 'not_initialized',
        message: 'WebSocket provider not registered',
      });
    });

    it('should return healthy status with connection stats', async () => {
      indicator.setProvider(mockProvider);
      mockProvider.getConnectedUsersCount.mockReturnValue(10);
      mockProvider.getTotalConnectionsCount.mockReturnValue(25);

      const result = await indicator.isHealthy('websocket');

      expect(result.websocket).toMatchObject({
        status: 'operational',
        connectedUsers: 10,
        totalConnections: 25,
        averageConnectionsPerUser: '2.50',
      });
    });

    it('should return 0 average when no users connected', async () => {
      indicator.setProvider(mockProvider);
      mockProvider.getConnectedUsersCount.mockReturnValue(0);
      mockProvider.getTotalConnectionsCount.mockReturnValue(0);

      const result = await indicator.isHealthy('websocket');

      expect(result.websocket).toMatchObject({
        status: 'operational',
        connectedUsers: 0,
        totalConnections: 0,
        averageConnectionsPerUser: '0',
      });
    });

    it('should throw HealthCheckError when provider throws', async () => {
      indicator.setProvider(mockProvider);
      mockProvider.getConnectedUsersCount.mockImplementation(() => {
        throw new Error('Provider error');
      });

      await expect(indicator.isHealthy('websocket')).rejects.toThrow(HealthCheckError);
    });

    it('should include error message in HealthCheckError', async () => {
      indicator.setProvider(mockProvider);
      mockProvider.getConnectedUsersCount.mockImplementation(() => {
        throw new Error('Connection pool exhausted');
      });

      try {
        await indicator.isHealthy('websocket');
        fail('Expected HealthCheckError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect((error as HealthCheckError).message).toBe('WebSocket check failed');
      }
    });

    it('should handle non-Error exceptions', async () => {
      indicator.setProvider(mockProvider);
      mockProvider.getConnectedUsersCount.mockImplementation(() => {
        throw 'String error';
      });

      try {
        await indicator.isHealthy('websocket');
        fail('Expected HealthCheckError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
      }
    });

    it('should use custom key in result', async () => {
      indicator.setProvider(mockProvider);
      mockProvider.getConnectedUsersCount.mockReturnValue(5);
      mockProvider.getTotalConnectionsCount.mockReturnValue(10);

      const result = await indicator.isHealthy('custom-ws-key');

      expect(result).toHaveProperty('custom-ws-key');
      expect(result['custom-ws-key']).toMatchObject({
        status: 'operational',
        connectedUsers: 5,
      });
    });

    it('should calculate average connections correctly', async () => {
      indicator.setProvider(mockProvider);
      mockProvider.getConnectedUsersCount.mockReturnValue(3);
      mockProvider.getTotalConnectionsCount.mockReturnValue(7);

      const result = await indicator.isHealthy('websocket');

      expect(result.websocket.averageConnectionsPerUser).toBe('2.33');
    });

    it('should handle single user with single connection', async () => {
      indicator.setProvider(mockProvider);
      mockProvider.getConnectedUsersCount.mockReturnValue(1);
      mockProvider.getTotalConnectionsCount.mockReturnValue(1);

      const result = await indicator.isHealthy('websocket');

      expect(result.websocket.averageConnectionsPerUser).toBe('1.00');
    });

    it('should handle large numbers', async () => {
      indicator.setProvider(mockProvider);
      mockProvider.getConnectedUsersCount.mockReturnValue(10000);
      mockProvider.getTotalConnectionsCount.mockReturnValue(50000);

      const result = await indicator.isHealthy('websocket');

      expect(result.websocket.connectedUsers).toBe(10000);
      expect(result.websocket.totalConnections).toBe(50000);
      expect(result.websocket.averageConnectionsPerUser).toBe('5.00');
    });
  });
});

describe('IWebSocketHealthProvider Interface', () => {
  it('should define required methods', () => {
    const provider: IWebSocketHealthProvider = {
      getConnectedUsersCount: () => 0,
      getTotalConnectionsCount: () => 0,
    };

    expect(provider.getConnectedUsersCount).toBeDefined();
    expect(provider.getTotalConnectionsCount).toBeDefined();
  });
});

