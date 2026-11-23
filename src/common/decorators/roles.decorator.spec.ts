import { Roles, ROLES_KEY } from './roles.decorator';
import { UserRole } from '@prisma/client';

describe('Roles Decorator', () => {
    it('should export ROLES_KEY constant', () => {
        expect(ROLES_KEY).toBe('roles');
    });

    it('should set roles metadata with single role', () => {
        @Roles(UserRole.ADMIN)
        class TestController { }

        const metadata = Reflect.getMetadata(ROLES_KEY, TestController);
        expect(metadata).toEqual([UserRole.ADMIN]);
    });

    it('should set roles metadata with multiple roles', () => {
        @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
        class TestController { }

        const metadata = Reflect.getMetadata(ROLES_KEY, TestController);
        expect(metadata).toEqual([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    });

    it('should work on methods', () => {
        class TestController {
            @Roles(UserRole.USER)
            testMethod() { }
        }

        const metadata = Reflect.getMetadata(ROLES_KEY, TestController.prototype.testMethod);
        expect(metadata).toEqual([UserRole.USER]);
    });

    it('should set empty array when no roles provided', () => {
        @Roles()
        class TestController { }

        const metadata = Reflect.getMetadata(ROLES_KEY, TestController);
        expect(metadata).toEqual([]);
    });
});
