import { LoggingInterceptor } from './logging.interceptor';
import { ConfigService } from '@nestjs/config';
import { createMockExecutionContext, createMockCallHandler } from '../../test/test-helpers';

describe('LoggingInterceptor', () => {
    let interceptor: LoggingInterceptor;
    let configService: jest.Mocked<ConfigService>;

    beforeEach(() => {
        configService = {
            get: jest.fn((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                    'app.performance.slowRequestWarningThreshold': 1000,
                    'app.performance.slowRequestCriticalThreshold': 3000,
                };
                return config[key] ?? defaultValue;
            }),
        } as any;

        interceptor = new LoggingInterceptor(configService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('intercept', () => {
        it('should log request details on completion', (done) => {
            const loggerSpy = jest.spyOn((interceptor as any).logger, 'log');

            const mockRequest = {
                method: 'GET',
                originalUrl: '/api/users',
                requestId: 'req-123',
                ip: '127.0.0.1',
                headers: { 'user-agent': 'test-agent' },
            };
            const mockResponse = {
                statusCode: 200,
            };

            const context = createMockExecutionContext();
            (context.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
            (context.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);

            const callHandler = createMockCallHandler({ data: 'test' });

            interceptor.intercept(context, callHandler).subscribe(() => {
                expect(loggerSpy).toHaveBeenCalled();
                const logCalls = loggerSpy.mock.calls as any[][];
                expect(logCalls.some(call => call[0].includes('GET') && call[0].includes('/api/users'))).toBe(true);
                expect(logCalls.some(call => call[0].includes('200'))).toBe(true);
                done();
            });
        });

        it('should handle missing requestId gracefully', (done) => {
            const loggerSpy = jest.spyOn((interceptor as any).logger, 'log');

            const mockRequest = {
                method: 'POST',
                originalUrl: '/api/auth/login',
                ip: '127.0.0.1',
                headers: { 'user-agent': 'test-agent' },
            };
            const mockResponse = {
                statusCode: 201,
            };

            const context = createMockExecutionContext();
            (context.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
            (context.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);

            const callHandler = createMockCallHandler({});

            interceptor.intercept(context, callHandler).subscribe(() => {
                expect(loggerSpy).toHaveBeenCalled();
                const logCalls = loggerSpy.mock.calls as any[][];
                expect(logCalls.some(call => call[0].includes('-'))).toBe(true);
                done();
            });
        });

        it('should use url fallback when originalUrl is not available', (done) => {
            const loggerSpy = jest.spyOn((interceptor as any).logger, 'log');

            const mockRequest = {
                method: 'GET',
                url: '/fallback-url',
                ip: '127.0.0.1',
                headers: { 'user-agent': 'test-agent' },
            };
            const mockResponse = {
                statusCode: 200,
            };

            const context = createMockExecutionContext();
            (context.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
            (context.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);

            const callHandler = createMockCallHandler({});

            interceptor.intercept(context, callHandler).subscribe(() => {
                const logCalls = loggerSpy.mock.calls as any[][];
                expect(logCalls.some(call => call[0].includes('/fallback-url'))).toBe(true);
                done();
            });
        });

        it('should calculate response time', (done) => {
            const loggerSpy = jest.spyOn((interceptor as any).logger, 'log');

            const mockRequest = {
                method: 'GET',
                originalUrl: '/test',
                ip: '127.0.0.1',
                headers: { 'user-agent': 'test-agent' },
            };
            const mockResponse = { statusCode: 200 };

            const context = createMockExecutionContext();
            (context.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
            (context.switchToHttp().getResponse as jest.Mock).mockReturnValue(mockResponse);

            const callHandler = createMockCallHandler({});

            interceptor.intercept(context, callHandler).subscribe(() => {
                const logCalls = loggerSpy.mock.calls as any[][];
                expect(logCalls.some(call => call[0].match(/\d+ms/))).toBe(true);
                done();
            });
        });

        it('should use configurable thresholds from ConfigService', () => {
            const customConfigService = {
                get: jest.fn((key: string, defaultValue?: any) => {
                    if (key === 'app.performance.slowRequestWarningThreshold') return 500;
                    if (key === 'app.performance.slowRequestCriticalThreshold') return 2000;
                    return defaultValue;
                }),
            } as any;

            const customInterceptor = new LoggingInterceptor(customConfigService);
            expect((customInterceptor as any).slowRequestWarningThreshold).toBe(500);
            expect((customInterceptor as any).slowRequestCriticalThreshold).toBe(2000);
        });

        it('should use default thresholds when config is not available', () => {
            const configServiceWithoutConfig = {
                get: jest.fn((key: string, defaultValue?: any) => defaultValue),
            } as any;

            const interceptorWithDefaults = new LoggingInterceptor(configServiceWithoutConfig);
            expect((interceptorWithDefaults as any).slowRequestWarningThreshold).toBe(1000);
            expect((interceptorWithDefaults as any).slowRequestCriticalThreshold).toBe(3000);
        });
    });
});
