import { CurrentUser } from './current-user.decorator';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('CurrentUser Decorator', () => {
    function getParamDecoratorFactory(decorator: Function) {
        class Test {
            public test(@decorator() value: any) { }
        }
        const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Test, 'test');
        return args[Object.keys(args)[0]].factory;
    }

    describe('decorator factory', () => {
        it('should extract user from request', () => {
            const mockUser = { id: 1, email: 'test@test.com', role: 'USER' };
            const mockRequest = { user: mockUser };

            const mockContext = {
                switchToHttp: () => ({
                    getRequest: () => mockRequest,
                }),
            } as ExecutionContext;

            const factory = getParamDecoratorFactory(CurrentUser);
            const result = factory(null, mockContext);

            expect(result).toEqual(mockUser);
        });

        it('should throw UnauthorizedException when no user is present', () => {
            const mockRequest = {};

            const mockContext = {
                switchToHttp: () => ({
                    getRequest: () => mockRequest,
                }),
            } as ExecutionContext;

            const factory = getParamDecoratorFactory(CurrentUser);

            expect(() => factory(null, mockContext)).toThrow(UnauthorizedException);
            expect(() => factory(null, mockContext)).toThrow('User not authenticated');
        });

        it('should throw UnauthorizedException when user is null', () => {
            const mockRequest = { user: null };

            const mockContext = {
                switchToHttp: () => ({
                    getRequest: () => mockRequest,
                }),
            } as ExecutionContext;

            const factory = getParamDecoratorFactory(CurrentUser);

            expect(() => factory(null, mockContext)).toThrow(UnauthorizedException);
            expect(() => factory(null, mockContext)).toThrow('User not authenticated');
        });

        it('should support type safety with generic type parameter', () => {
            interface TestUser {
                id: number;
                email: string;
                role: string;
            }

            const mockUser: TestUser = { id: 1, email: 'test@test.com', role: 'USER' };
            const mockRequest = { user: mockUser };

            const mockContext = {
                switchToHttp: () => ({
                    getRequest: () => mockRequest,
                }),
            } as ExecutionContext;

            const factory = getParamDecoratorFactory(CurrentUser) as (data: unknown, ctx: ExecutionContext) => TestUser;
            const result = factory(null, mockContext);

            expect(result).toEqual(mockUser);
            expect(result.id).toBe(1);
            expect(result.email).toBe('test@test.com');
            expect(result.role).toBe('USER');
        });
    });
});
