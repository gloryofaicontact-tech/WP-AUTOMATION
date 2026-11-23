import { ArgumentsHost, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { WsExceptionFilter, WsAuthenticationException, WsAuthorizationException, WsNotFoundException, WsRateLimitException, WsValidationException, WsConversationBlockedException, createWsErrorResponse,} from './ws-exception.filter';

describe('WsExceptionFilter', () => {
  let filter: WsExceptionFilter;
  let mockClient: jest.Mocked<Socket>;
  let mockHost: jest.Mocked<ArgumentsHost>;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    filter = new WsExceptionFilter();

    mockClient = {
      id: 'socket-123',
      emit: jest.fn(),
    } as unknown as jest.Mocked<Socket>;

    mockHost = {
      switchToWs: jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue(mockClient),
        getData: jest.fn().mockReturnValue({}),
      }),
    } as unknown as jest.Mocked<ArgumentsHost>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createWsErrorResponse', () => {
    it('should create error response with message only', () => {
      const response = createWsErrorResponse('Test error');

      expect(response).toEqual({
        success: false,
        error: 'Test error',
        code: undefined,
        timestamp: expect.any(String),
      });
    });

    it('should create error response with message and code', () => {
      const response = createWsErrorResponse('Test error', 'TEST_CODE');

      expect(response).toEqual({
        success: false,
        error: 'Test error',
        code: 'TEST_CODE',
        timestamp: expect.any(String),
      });
    });
  });

  describe('catch', () => {
    it('should handle WsException with string error', () => {
      const exception = new WsException('Test WS error');

      filter.catch(exception, mockHost);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          success: false,
          error: 'Test WS error',
          code: 'WS_ERROR',
        }),
      );
    });

    it('should handle WsException with object error', () => {
      const exception = new WsException({ message: 'Object error', code: 'CUSTOM_CODE' });

      filter.catch(exception, mockHost);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          success: false,
          error: 'Object error',
          code: 'CUSTOM_CODE',
        }),
      );
    });

    it('should handle WsException with object error without message', () => {
      const exception = new WsException({ code: 'ONLY_CODE' });

      filter.catch(exception, mockHost);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          success: false,
          error: 'An unexpected error occurred',
          code: 'ONLY_CODE',
        }),
      );
    });

    it('should handle WsException with object error without code', () => {
      const exception = new WsException({ message: 'Only message' });

      filter.catch(exception, mockHost);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          success: false,
          error: 'Only message',
          code: 'INTERNAL_ERROR',
        }),
      );
    });

    it('should handle standard Error', () => {
      const exception = new Error('Standard error');

      filter.catch(exception, mockHost);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          success: false,
          error: 'Standard error',
          code: 'Error',
        }),
      );
    });

    it('should handle custom Error with name', () => {
      const exception = new TypeError('Type error message');

      filter.catch(exception, mockHost);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          success: false,
          error: 'Type error message',
          code: 'TypeError',
        }),
      );
    });

    it('should handle unknown exception', () => {
      const exception = 'string exception';

      filter.catch(exception, mockHost);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          success: false,
          error: 'An unexpected error occurred',
          code: 'INTERNAL_ERROR',
        }),
      );
    });

    it('should handle null exception', () => {
      filter.catch(null, mockHost);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          success: false,
          error: 'An unexpected error occurred',
          code: 'INTERNAL_ERROR',
        }),
      );
    });

    it('should call ack function if present in data', () => {
      const ackFn = jest.fn();
      mockHost.switchToWs = jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue(mockClient),
        getData: jest.fn().mockReturnValue({ ack: ackFn }),
      });

      const exception = new WsException('Test error');

      filter.catch(exception, mockHost);

      expect(ackFn).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Test error',
        }),
      );
    });

    it('should not call ack if data is not an object', () => {
      mockHost.switchToWs = jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue(mockClient),
        getData: jest.fn().mockReturnValue('string data'),
      });

      const exception = new WsException('Test error');

      filter.catch(exception, mockHost);

      expect(mockClient.emit).toHaveBeenCalled();
    });

    it('should not call ack if ack is not a function', () => {
      mockHost.switchToWs = jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue(mockClient),
        getData: jest.fn().mockReturnValue({ ack: 'not a function' }),
      });

      const exception = new WsException('Test error');

      filter.catch(exception, mockHost);

      expect(mockClient.emit).toHaveBeenCalled();
    });

    it('should not call ack if data is null', () => {
      mockHost.switchToWs = jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue(mockClient),
        getData: jest.fn().mockReturnValue(null),
      });

      const exception = new WsException('Test error');

      filter.catch(exception, mockHost);

      expect(mockClient.emit).toHaveBeenCalled();
    });
  });
});

describe('Custom WS Exceptions', () => {
  describe('WsAuthenticationException', () => {
    it('should create with default message', () => {
      const exception = new WsAuthenticationException();
      const error = exception.getError() as { message: string; code: string };

      expect(error.message).toBe('Authentication failed');
      expect(error.code).toBe('AUTH_FAILED');
    });

    it('should create with custom message', () => {
      const exception = new WsAuthenticationException('Invalid token');
      const error = exception.getError() as { message: string; code: string };

      expect(error.message).toBe('Invalid token');
      expect(error.code).toBe('AUTH_FAILED');
    });
  });

  describe('WsAuthorizationException', () => {
    it('should create with default message', () => {
      const exception = new WsAuthorizationException();
      const error = exception.getError() as { message: string; code: string };

      expect(error.message).toBe('Not authorized to perform this action');
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create with custom message', () => {
      const exception = new WsAuthorizationException('Admin access required');
      const error = exception.getError() as { message: string; code: string };

      expect(error.message).toBe('Admin access required');
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('WsNotFoundException', () => {
    it('should create with default resource', () => {
      const exception = new WsNotFoundException();
      const error = exception.getError() as { message: string; code: string };

      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create with custom resource', () => {
      const exception = new WsNotFoundException('Conversation');
      const error = exception.getError() as { message: string; code: string };

      expect(error.message).toBe('Conversation not found');
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('WsRateLimitException', () => {
    it('should create with default retry after', () => {
      const exception = new WsRateLimitException();
      const error = exception.getError() as { message: string; code: string; retryAfter: number };

      expect(error.message).toBe('Rate limit exceeded. Retry after 60 seconds');
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.retryAfter).toBe(60);
    });

    it('should create with custom retry after', () => {
      const exception = new WsRateLimitException(120);
      const error = exception.getError() as { message: string; code: string; retryAfter: number };

      expect(error.message).toBe('Rate limit exceeded. Retry after 120 seconds');
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.retryAfter).toBe(120);
    });
  });

  describe('WsValidationException', () => {
    it('should create with validation errors', () => {
      const errors = ['Field is required', 'Invalid format'];
      const exception = new WsValidationException(errors);
      const error = exception.getError() as { message: string; code: string; errors: string[] };

      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.errors).toEqual(errors);
    });

    it('should create with empty errors array', () => {
      const exception = new WsValidationException([]);
      const error = exception.getError() as { message: string; code: string; errors: string[] };

      expect(error.message).toBe('Validation failed');
      expect(error.errors).toEqual([]);
    });
  });

  describe('WsConversationBlockedException', () => {
    it('should create exception', () => {
      const exception = new WsConversationBlockedException();
      const error = exception.getError() as { message: string; code: string };

      expect(error.message).toBe('Conversation is blocked');
      expect(error.code).toBe('CONVERSATION_BLOCKED');
    });
  });
});

