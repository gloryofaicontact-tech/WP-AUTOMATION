import { RequestIdMiddleware } from './request-id.middleware';
import { Request, Response, NextFunction } from 'express';

jest.mock('uuid', () => ({
    v4: jest.fn().mockReturnValue('mock-uuid-1234'),
}));

describe('RequestIdMiddleware', () => {
    let middleware: RequestIdMiddleware;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        middleware = new RequestIdMiddleware();
        mockRequest = {
            headers: {},
            ip: '127.0.0.1',
            url: '/test',
            originalUrl: '/test',
            connection: { remoteAddress: '127.0.0.1' } as any,
        };
        mockResponse = {
            setHeader: jest.fn(),
        };
        mockNext = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('use', () => {
        it('should generate a new request ID when none is provided', () => {
            middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

            expect((mockRequest as any).requestId).toBe('mock-uuid-1234');
            expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', 'mock-uuid-1234');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should use valid x-request-id header if provided', () => {
            mockRequest.headers = { 'x-request-id': 'existing-request-id' };

            middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

            expect((mockRequest as any).requestId).toBe('existing-request-id');
            expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', 'existing-request-id');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should accept UUID format headers', () => {
            const uuid = '550e8400-e29b-41d4-a716-446655440000';
            mockRequest.headers = { 'x-request-id': uuid };

            middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

            expect((mockRequest as any).requestId).toBe(uuid);
            expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', uuid);
        });

        it('should accept headers with dots and underscores', () => {
            const validId = 'request.id_123-test';
            mockRequest.headers = { 'x-request-id': validId };

            middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

            expect((mockRequest as any).requestId).toBe(validId);
        });

        it('should trim whitespace from valid headers', () => {
            mockRequest.headers = { 'x-request-id': '  valid-id  ' };

            middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

            expect((mockRequest as any).requestId).toBe('valid-id');
            expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', 'valid-id');
        });

        it('should reject headers with invalid characters and generate new UUID', () => {
            const loggerSpy = jest.spyOn((middleware as any).logger, 'warn');
            mockRequest.headers = { 'x-request-id': 'invalid<script>alert("xss")</script>' };

            middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

            expect((mockRequest as any).requestId).toBe('mock-uuid-1234');
            expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', 'mock-uuid-1234');
            expect(loggerSpy).toHaveBeenCalled();
            expect(loggerSpy.mock.calls[0][0]).toContain('Invalid X-Request-ID header rejected');
        });

        it('should reject headers that are too long and generate new UUID', () => {
            const loggerSpy = jest.spyOn((middleware as any).logger, 'warn');
            const longId = 'a'.repeat(200); // Exceeds MAX_REQUEST_ID_LENGTH (128)
            mockRequest.headers = { 'x-request-id': longId };

            middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

            expect((mockRequest as any).requestId).toBe('mock-uuid-1234');
            expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', 'mock-uuid-1234');
            expect(loggerSpy).toHaveBeenCalled();
            expect(loggerSpy.mock.calls[0][0]).toContain('exceeds max length');
        });

        it('should reject headers with spaces and generate new UUID', () => {
            const loggerSpy = jest.spyOn((middleware as any).logger, 'warn');
            mockRequest.headers = { 'x-request-id': 'invalid id with spaces' };

            middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

            expect((mockRequest as any).requestId).toBe('mock-uuid-1234');
            expect(loggerSpy).toHaveBeenCalled();
        });

        it('should reject headers with special characters and generate new UUID', () => {
            const loggerSpy = jest.spyOn((middleware as any).logger, 'warn');
            mockRequest.headers = { 'x-request-id': 'invalid@id#with$special%chars' };

            middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

            expect((mockRequest as any).requestId).toBe('mock-uuid-1234');
            expect(loggerSpy).toHaveBeenCalled();
        });

        it('should generate new UUID for empty header after trimming', () => {
            mockRequest.headers = { 'x-request-id': '   ' };

            middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

            expect((mockRequest as any).requestId).toBe('mock-uuid-1234');
            expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', 'mock-uuid-1234');
        });

        it('should generate new UUID when header is an array', () => {
            mockRequest.headers = { 'x-request-id': ['id1', 'id2'] as any };

            middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

            expect((mockRequest as any).requestId).toBe('mock-uuid-1234');
            expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', 'mock-uuid-1234');
        });

        it('should log warning with IP and URL for invalid headers', () => {
            const loggerSpy = jest.spyOn((middleware as any).logger, 'warn');
            mockRequest.headers = { 'x-request-id': 'invalid<script>' };
            (mockRequest as any).ip = '192.168.1.1';
            mockRequest.url = '/api/users';

            middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

            expect(loggerSpy).toHaveBeenCalled();
            const logMessage = loggerSpy.mock.calls[0][0];
            expect(logMessage).toContain('192.168.1.1');
            expect(logMessage).toContain('/api/users');
        });

        it('should call next function', () => {
            middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should accept maximum length header (128 characters)', () => {
            const maxLengthId = 'a'.repeat(128);
            mockRequest.headers = { 'x-request-id': maxLengthId };

            middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

            expect((mockRequest as any).requestId).toBe(maxLengthId);
            expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', maxLengthId);
        });
    });
});
