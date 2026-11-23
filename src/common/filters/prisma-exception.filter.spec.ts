import { PrismaClientExceptionFilter } from './prisma-exception.filter';
import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createMockArgumentsHost } from '../../test/test-helpers';

describe('PrismaClientExceptionFilter', () => {
  let filter: PrismaClientExceptionFilter;

  beforeEach(() => {
    filter = new PrismaClientExceptionFilter();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('catch', () => {
    it('should handle P2002 (Unique constraint violation) with standardized format', () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockRequest = { url: '/test', method: 'POST' };
      const host = createMockArgumentsHost();
      (host.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);
      (host.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

      const exception = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0', meta: { target: ['email'] } },
      );

      filter.catch(exception, host as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          success: false,
          message: 'A record with this email already exists.',
          error: expect.objectContaining({
            code: 'UNIQUE_CONSTRAINT_VIOLATION',
            details: { fields: ['email'] },
          }),
          meta: expect.objectContaining({
            timestamp: expect.any(String),
            path: '/test',
          }),
        }),
      );
    });

    it('should handle P2002 with multiple fields', () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockRequest = { url: '/test', method: 'POST' };
      const host = createMockArgumentsHost();
      (host.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);
      (host.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

      const exception = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0', meta: { target: ['email', 'phone'] } },
      );

      filter.catch(exception, host as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          success: false,
          message: 'A record with this email, phone already exists.',
          error: expect.objectContaining({
            code: 'UNIQUE_CONSTRAINT_VIOLATION',
            details: { fields: ['email', 'phone'] },
          }),
        }),
      );
    });

    it('should handle P2025 (Record not found) with standardized format', () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockRequest = { url: '/test/123', method: 'GET' };
      const host = createMockArgumentsHost();
      (host.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);
      (host.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

      const exception = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0' },
      );

      filter.catch(exception, host as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          success: false,
          message: 'The requested record was not found.',
          error: expect.objectContaining({
            code: 'RECORD_NOT_FOUND',
          }),
          meta: expect.objectContaining({
            timestamp: expect.any(String),
            path: '/test/123',
          }),
        }),
      );
    });

    it('should handle P2003 (Foreign key constraint violation)', () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockRequest = { url: '/test', method: 'POST' };
      const host = createMockArgumentsHost();
      (host.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);
      (host.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

      const exception = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        { code: 'P2003', clientVersion: '5.0.0', meta: { field_name: 'userId' } },
      );

      filter.catch(exception, host as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          success: false,
          error: expect.objectContaining({
            code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
          }),
        }),
      );
    });

    it('should handle P2002 with no target metadata', () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockRequest = { url: '/test', method: 'POST' };
      const host = createMockArgumentsHost();
      (host.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);
      (host.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

      const exception = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0', meta: {} },
      );

      filter.catch(exception, host as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          success: false,
          message: 'A record with these values already exists.',
          error: expect.objectContaining({
            code: 'UNIQUE_CONSTRAINT_VIOLATION',
            details: { fields: [] },
          }),
        }),
      );
    });

    it('should delegate unknown error codes to parent filter', () => {
      const mockRequest = { url: '/test', method: 'POST' };
      const host = createMockArgumentsHost();
      (host.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

      const superCatchSpy = jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(filter)), 'catch')
        .mockImplementation(() => {});

      const exception = new Prisma.PrismaClientKnownRequestError(
        'Unknown error',
        { code: 'P9999', clientVersion: '5.0.0' },
      );

      filter.catch(exception, host as any);

      expect(superCatchSpy).toHaveBeenCalledWith(exception, host);
      superCatchSpy.mockRestore();
    });

    it('should always set success to false', () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockRequest = { url: '/test', method: 'GET' };
      const host = createMockArgumentsHost();
      (host.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);
      (host.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

      const exception = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0' },
      );

      filter.catch(exception, host as any);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.success).toBe(false);
    });
  });
});
