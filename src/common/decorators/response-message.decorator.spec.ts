import { ResponseMessage, RESPONSE_MESSAGE_KEY } from './response-message.decorator';

describe('ResponseMessage Decorator', () => {
    it('should export RESPONSE_MESSAGE_KEY constant', () => {
        expect(RESPONSE_MESSAGE_KEY).toBe('response_message');
    });

    it('should set response message metadata', () => {
        class TestController {
            @ResponseMessage('Custom success message')
            testMethod() { }
        }

        const metadata = Reflect.getMetadata(RESPONSE_MESSAGE_KEY, TestController.prototype.testMethod);
        expect(metadata).toBe('Custom success message');
    });

    it('should work on class', () => {
        @ResponseMessage('Class level message')
        class TestController { }

        const metadata = Reflect.getMetadata(RESPONSE_MESSAGE_KEY, TestController);
        expect(metadata).toBe('Class level message');
    });

    it('should handle empty string', () => {
        class TestController {
            @ResponseMessage('')
            testMethod() { }
        }

        const metadata = Reflect.getMetadata(RESPONSE_MESSAGE_KEY, TestController.prototype.testMethod);
        expect(metadata).toBe('');
    });
});
