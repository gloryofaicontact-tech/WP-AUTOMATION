import { AllExceptionsFilter, ErrorResponse } from './all-exceptions.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  createMockHttpAdapterHost,
  createMockArgumentsHost,
} from '../../test/test-helpers';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let httpAdapterHost: ReturnType<typeof createMockHttpAdapterHost>;

  beforeEach(() => {
    httpAdapterHost = createMockHttpAdapterHost();
    filter = new AllExceptionsFilter(
      httpAdapterHost as unknown as HttpAdapterHost,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('catch', () => {
    it('should handle HttpException with standardized response format', () => {
      const host = createMockArgumentsHost({ url: '/test' });
      const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      filter.catch(exception, host as any);

      expect(httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          success: false,
          message: 'Bad Request',
          meta: expect.objectContaining({
            path: '/test-path',
            timestamp: expect.any(String),
          }),
        }),
        HttpStatus.BAD_REQUEST,
      );
    });

    it('should handle generic exceptions as 500 Internal Server Error', () => {
      const host = createMockArgumentsHost({ url: '/test' });
      const exception = new Error('Something went wrong');

      filter.catch(exception, host as any);

      expect(httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          success: false,
          message: 'Internal Server Error',
        }),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('should include meta with timestamp and path in response', () => {
      const host = createMockArgumentsHost();
      const exception = new Error('Test error');

      filter.catch(exception, host as any);

      expect(httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          meta: expect.objectContaining({
            timestamp: expect.any(String),
            path: expect.any(String),
          }),
        }),
        expect.any(Number),
      );
    });

    it('should handle HttpException with object response containing message', () => {
      const host = createMockArgumentsHost();
      const exception = new HttpException(
        { message: 'Custom error message', error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, host as any);

      expect(httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          success: false,
          message: 'Custom error message',
          error: expect.objectContaining({
            code: 'BAD_REQUEST',
          }),
        }),
        HttpStatus.BAD_REQUEST,
      );
    });

    it('should handle validation errors with array of messages', () => {
      const host = createMockArgumentsHost();
      const exception = new HttpException(
        { message: ['field1 is required', 'field2 must be a string'] },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, host as any);

      expect(httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          success: false,
          message: 'Validation failed',
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            details: ['field1 is required', 'field2 must be a string'],
          }),
        }),
        HttpStatus.BAD_REQUEST,
      );
    });

    it('should log internal server errors with stack trace', () => {
      const loggerSpy = jest.spyOn((filter as any).logger, 'error');
      const host = createMockArgumentsHost();
      const exception = new Error('Database connection failed');

      filter.catch(exception, host as any);

      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should log client errors at warn level', () => {
      const loggerWarnSpy = jest.spyOn((filter as any).logger, 'warn');
      const host = createMockArgumentsHost();
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, host as any);

      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    it('should handle HttpException with object response without message property', () => {
      const host = createMockArgumentsHost();
      const exception = new HttpException(
        { error: 'Bad Request', statusCode: 400 },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, host as any);

      expect(httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          success: false,
        }),
        HttpStatus.BAD_REQUEST,
      );
    });

    it('should set success to false for all error responses', () => {
      const host = createMockArgumentsHost();
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, host as any);

      const response = httpAdapterHost.httpAdapter.reply.mock.calls[0][1] as ErrorResponse;
      expect(response.success).toBe(false);
    });
  });
});
