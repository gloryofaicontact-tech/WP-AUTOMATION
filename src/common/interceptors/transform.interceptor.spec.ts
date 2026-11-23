import { TransformInterceptor } from './transform.interceptor';
import { of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { createMockExecutionContext, createMockCallHandler } from '../../test/test-helpers';

describe('TransformInterceptor', () => {
    let interceptor: TransformInterceptor<any>;
    let reflector: jest.Mocked<Reflector>;

    beforeEach(() => {
        reflector = {
            getAllAndOverride: jest.fn(),
        } as any;
        interceptor = new TransformInterceptor(reflector);
    });

    describe('intercept', () => {
        it('should wrap response in standard format', (done) => {
            const mockRequest = { url: '/api/test' };
            const mockResponse = { statusCode: 200 };

            const context = createMockExecutionContext();
            (context.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
            (context.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);

            const callHandler = createMockCallHandler({ id: 1, name: 'test' });

            interceptor.intercept(context, callHandler).subscribe((result) => {
                expect(result).toEqual({
                    statusCode: 200,
                    success: true,
                    message: 'Success',
                    data: { id: 1, name: 'test' },
                    meta: {
                        timestamp: expect.any(String),
                        path: '/api/test',
                    },
                });
                done();
            });
        });

        it('should extract message from response data', (done) => {
            const mockRequest = { url: '/api/test' };
            const mockResponse = { statusCode: 200 };

            const context = createMockExecutionContext();
            (context.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
            (context.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);

            const callHandler = createMockCallHandler({
                message: 'Custom message',
                user: { id: 1 }
            });

            interceptor.intercept(context, callHandler).subscribe((result) => {
                expect(result.message).toBe('Custom message');
                expect(result.data).toEqual({ user: { id: 1 } });
                done();
            });
        });

        it('should set data to null when only message is present', (done) => {
            const mockRequest = { url: '/api/test' };
            const mockResponse = { statusCode: 200 };

            const context = createMockExecutionContext();
            (context.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
            (context.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);

            const callHandler = createMockCallHandler({ message: 'Operation successful' });

            interceptor.intercept(context, callHandler).subscribe((result) => {
                expect(result.message).toBe('Operation successful');
                expect(result.data).toBeNull();
                done();
            });
        });

        it('should handle array responses', (done) => {
            const mockRequest = { url: '/api/test' };
            const mockResponse = { statusCode: 200 };

            const context = createMockExecutionContext();
            (context.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
            (context.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);

            const callHandler = createMockCallHandler([{ id: 1 }, { id: 2 }]);

            interceptor.intercept(context, callHandler).subscribe((result) => {
                expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
                expect(result.message).toBe('Success');
                done();
            });
        });

        it('should set success to true for 2xx status codes', (done) => {
            const mockRequest = { url: '/api/test' };
            const mockResponse = { statusCode: 201 };

            const context = createMockExecutionContext();
            (context.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
            (context.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);

            const callHandler = createMockCallHandler({ created: true });

            interceptor.intercept(context, callHandler).subscribe((result) => {
                expect(result.success).toBe(true);
                expect(result.statusCode).toBe(201);
                done();
            });
        });

        it('should include timestamp in meta', (done) => {
            const mockRequest = { url: '/api/test' };
            const mockResponse = { statusCode: 200 };

            const context = createMockExecutionContext();
            (context.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
            (context.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);

            const callHandler = createMockCallHandler({});

            interceptor.intercept(context, callHandler).subscribe((result) => {
                expect(result.meta?.timestamp).toBeDefined();
                expect(new Date(result.meta!.timestamp)).toBeInstanceOf(Date);
                done();
            });
        });
    });
});
