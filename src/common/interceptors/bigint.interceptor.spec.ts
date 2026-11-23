import { BigIntInterceptor } from './bigint.interceptor';
import { of } from 'rxjs';
import { createMockExecutionContext, createMockCallHandler } from '../../test/test-helpers';

describe('BigIntInterceptor', () => {
    let interceptor: BigIntInterceptor;

    beforeEach(() => {
        interceptor = new BigIntInterceptor();
    });

    describe('intercept', () => {
        it('should convert BigInt values to strings', (done) => {
            const context = createMockExecutionContext();
            const callHandler = createMockCallHandler({ id: BigInt(12345), name: 'test' });

            interceptor.intercept(context, callHandler).subscribe((result) => {
                expect(result.id).toBe('12345');
                expect(result.name).toBe('test');
                done();
            });
        });

        it('should handle null values', (done) => {
            const context = createMockExecutionContext();
            const callHandler = createMockCallHandler(null);

            interceptor.intercept(context, callHandler).subscribe((result) => {
                expect(result).toBeNull();
                done();
            });
        });

        it('should preserve undefined as empty object (interceptor behavior)', (done) => {
            const context = createMockExecutionContext();
            const callHandler = createMockCallHandler(undefined);

            interceptor.intercept(context, callHandler).subscribe((result) => {
                expect(result).toBeDefined();
                done();
            });
        });

        it('should handle nested objects with BigInt values', (done) => {
            const context = createMockExecutionContext();
            const callHandler = createMockCallHandler({
                user: {
                    id: BigInt(1),
                    posts: [{ id: BigInt(2) }, { id: BigInt(3) }],
                },
            });

            interceptor.intercept(context, callHandler).subscribe((result) => {
                expect(result.user.id).toBe('1');
                expect(result.user.posts[0].id).toBe('2');
                expect(result.user.posts[1].id).toBe('3');
                done();
            });
        });

        it('should handle arrays with BigInt values', (done) => {
            const context = createMockExecutionContext();
            const callHandler = createMockCallHandler([
                { id: BigInt(1) },
                { id: BigInt(2) },
            ]);

            interceptor.intercept(context, callHandler).subscribe((result) => {
                expect(result[0].id).toBe('1');
                expect(result[1].id).toBe('2');
                done();
            });
        });

        it('should preserve Date objects', (done) => {
            const context = createMockExecutionContext();
            const testDate = new Date('2024-01-01');
            const callHandler = createMockCallHandler({
                createdAt: testDate,
                id: BigInt(1),
            });

            interceptor.intercept(context, callHandler).subscribe((result) => {
                expect(result.createdAt).toBeInstanceOf(Date);
                expect(result.createdAt).toEqual(testDate);
                expect(result.id).toBe('1');
                done();
            });
        });

        it('should handle primitive values', (done) => {
            const context = createMockExecutionContext();
            const callHandler = createMockCallHandler('simple string');

            interceptor.intercept(context, callHandler).subscribe((result) => {
                expect(result).toBe('simple string');
                done();
            });
        });

        it('should handle numbers without conversion', (done) => {
            const context = createMockExecutionContext();
            const callHandler = createMockCallHandler({ count: 42, price: 19.99 });

            interceptor.intercept(context, callHandler).subscribe((result) => {
                expect(result.count).toBe(42);
                expect(result.price).toBe(19.99);
                done();
            });
        });
    });
});
