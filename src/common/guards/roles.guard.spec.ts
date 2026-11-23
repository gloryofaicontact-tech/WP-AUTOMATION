import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('RolesGuard', () => {
    let guard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
        reflector = new Reflector();
        guard = new RolesGuard(reflector);
    });

    const createMockContext = (user?: any): ExecutionContext => {
        return {
            switchToHttp: () => ({
                getRequest: () => ({
                    user,
                    method: 'GET',
                    url: '/test',
                    ip: '127.0.0.1',
                    connection: { remoteAddress: '127.0.0.1' },
                }),
            }),
            getHandler: () => jest.fn(),
            getClass: () => jest.fn(),
        } as unknown as ExecutionContext;
    };

    describe('canActivate', () => {
        it('should allow access to public routes', () => {
            const context = createMockContext();
            jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
                if (key === IS_PUBLIC_KEY) return true;
                return undefined;
            });

            expect(guard.canActivate(context)).toBe(true);
        });

        it('should allow access when no roles are required', () => {
            const context = createMockContext({ id: '1', role: UserRole.USER });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

            expect(guard.canActivate(context)).toBe(true);
        });

        it('should allow access when user has required role', () => {
            const context = createMockContext({ id: '1', role: UserRole.ADMIN });
            jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
                if (key === IS_PUBLIC_KEY) return false;
                if (key === ROLES_KEY) return [UserRole.ADMIN];
                return undefined;
            });

            expect(guard.canActivate(context)).toBe(true);
        });

        it('should throw ForbiddenException when user does not have required role', () => {
            const context = createMockContext({ id: '1', role: UserRole.USER });
            jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
                if (key === IS_PUBLIC_KEY) return false;
                if (key === ROLES_KEY) return [UserRole.ADMIN];
                return undefined;
            });

            expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
            expect(() => guard.canActivate(context)).toThrow('Access denied');
        });

        it('should throw UnauthorizedException when no user is present', () => {
            const context = createMockContext(undefined);
            jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
                if (key === IS_PUBLIC_KEY) return false;
                if (key === ROLES_KEY) return [UserRole.ADMIN];
                return undefined;
            });

            expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
            expect(() => guard.canActivate(context)).toThrow('User not authenticated');
        });

        it('should throw UnauthorizedException when user object is missing role property', () => {
            const context = createMockContext({ id: '1' }); // Missing role
            jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
                if (key === IS_PUBLIC_KEY) return false;
                if (key === ROLES_KEY) return [UserRole.ADMIN];
                return undefined;
            });

            expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
            expect(() => guard.canActivate(context)).toThrow('Invalid user session');
        });

        it('should throw UnauthorizedException when user role is not a string', () => {
            const context = createMockContext({ id: '1', role: 123 }); // Invalid role type
            jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
                if (key === IS_PUBLIC_KEY) return false;
                if (key === ROLES_KEY) return [UserRole.ADMIN];
                return undefined;
            });

            expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
            expect(() => guard.canActivate(context)).toThrow('Invalid user session');
        });

        it('should allow access when user has one of multiple required roles', () => {
            const context = createMockContext({ id: '1', role: UserRole.ADMIN });
            jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
                if (key === IS_PUBLIC_KEY) return false;
                if (key === ROLES_KEY) return [UserRole.USER, UserRole.ADMIN];
                return undefined;
            });

            expect(guard.canActivate(context)).toBe(true);
        });

        it('should include user role and required roles in ForbiddenException message', () => {
            const context = createMockContext({ id: '1', role: UserRole.USER });
            jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
                if (key === IS_PUBLIC_KEY) return false;
                if (key === ROLES_KEY) return [UserRole.ADMIN, UserRole.SUPER_ADMIN];
                return undefined;
            });

            expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
            expect(() => guard.canActivate(context)).toThrow('USER');
            expect(() => guard.canActivate(context)).toThrow('ADMIN');
        });
    });
});
