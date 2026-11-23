import { JwtAuthGuard } from './jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;
    let reflector: Reflector;

    beforeEach(() => {
        reflector = new Reflector();
        guard = new JwtAuthGuard(reflector);
    });

    const createMockContext = (): ExecutionContext => {
        return {
            switchToHttp: () => ({
                getRequest: () => ({
                    method: 'GET',
                    url: '/test',
                    ip: '127.0.0.1',
                }),
            }),
            getHandler: () => jest.fn(),
            getClass: () => jest.fn(),
        } as unknown as ExecutionContext;
    };

    describe('canActivate', () => {
        it('should return true for public routes', async () => {
            const context = createMockContext();
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
        });

        it('should check IS_PUBLIC_KEY metadata', async () => {
            const context = createMockContext();
            const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

            await guard.canActivate(context);

            expect(spy).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
                expect.any(Function),
                expect.any(Function),
            ]);
        });

        it('should call super.canActivate for non-public routes', async () => {
            const context = createMockContext();
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

            const superCanActivateSpy = jest
                .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
                .mockResolvedValue(true);

            const result = await guard.canActivate(context);

            expect(superCanActivateSpy).toHaveBeenCalledWith(context);
            expect(result).toBe(true);
            superCanActivateSpy.mockRestore();
        });

        it('should throw UnauthorizedException when super.canActivate returns false', async () => {
            const context = createMockContext();
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

            const superCanActivateSpy = jest
                .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
                .mockResolvedValue(false);

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
            superCanActivateSpy.mockRestore();
        });

        it('should throw UnauthorizedException when super.canActivate throws', async () => {
            const context = createMockContext();
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

            const superCanActivateSpy = jest
                .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
                .mockRejectedValue(new UnauthorizedException('Invalid token'));

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
            superCanActivateSpy.mockRestore();
        });

        it('should handle unexpected errors and throw UnauthorizedException', async () => {
            const context = createMockContext();
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

            const superCanActivateSpy = jest
                .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
                .mockRejectedValue(new Error('Unexpected error'));

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
            superCanActivateSpy.mockRestore();
        });
    });

    describe('handleRequest', () => {
        it('should throw UnauthorizedException when error is present', () => {
            const error = new Error('Test error');
            expect(() => guard.handleRequest(error, null, null)).toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when user is false', () => {
            expect(() => guard.handleRequest(null, false, { message: 'Invalid token' })).toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when user is null', () => {
            expect(() => guard.handleRequest(null, null, { message: 'Invalid token' })).toThrow(UnauthorizedException);
        });

        it('should return user when valid', () => {
            const user = { id: '1', email: 'test@example.com' };
            const result = guard.handleRequest(null, user, null);
            expect(result).toBe(user);
        });
    });
});
