import { Public, IS_PUBLIC_KEY } from './public.decorator';

describe('Public Decorator', () => {
    it('should export IS_PUBLIC_KEY constant', () => {
        expect(IS_PUBLIC_KEY).toBe('isPublic');
    });

    it('should set isPublic metadata to true', () => {
        @Public()
        class TestController { }

        const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, TestController);
        expect(metadata).toBe(true);
    });

    it('should work on methods', () => {
        class TestController {
            @Public()
            testMethod() { }
        }

        const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, TestController.prototype.testMethod);
        expect(metadata).toBe(true);
    });
});
