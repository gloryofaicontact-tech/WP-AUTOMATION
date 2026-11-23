import { BadRequestException } from '@nestjs/common';
import { ParseBigIntPipe } from './parse-bigint.pipe';

describe('ParseBigIntPipe', () => {
  let pipe: ParseBigIntPipe;

  const mockMetadata = {
    type: 'param' as const,
    metatype: String,
    data: 'id',
  };

  const mockMetadataWithoutData = {
    type: 'param' as const,
    metatype: String,
    data: undefined,
  };

  beforeEach(() => {
    pipe = new ParseBigIntPipe();
  });

  describe('transform', () => {
    it('should successfully transform a valid numeric string to bigint', () => {
      const result = pipe.transform('123', mockMetadata);

      expect(result).toBe(123n);
    });

    it('should successfully transform a large numeric string to bigint', () => {
      const largeNumber = '9223372036854775807';
      const result = pipe.transform(largeNumber, mockMetadata);

      expect(result).toBe(9223372036854775807n);
    });

    it('should successfully transform "0" to 0n', () => {
      const result = pipe.transform('0', mockMetadata);

      expect(result).toBe(0n);
    });

    it('should throw BadRequestException for empty string', () => {
      expect(() => pipe.transform('', mockMetadata)).toThrow(BadRequestException);
      expect(() => pipe.transform('', mockMetadata)).toThrow(
        'Invalid id: "" is not a valid ID. Expected a numeric value.',
      );
    });

    it('should throw BadRequestException for null value', () => {
      expect(() => pipe.transform(null as any, mockMetadata)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for undefined value', () => {
      expect(() => pipe.transform(undefined as any, mockMetadata)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-numeric string', () => {
      expect(() => pipe.transform('abc', mockMetadata)).toThrow(BadRequestException);
      expect(() => pipe.transform('abc', mockMetadata)).toThrow(
        'Invalid id: "abc" is not a valid ID. Expected a numeric value.',
      );
    });

    it('should throw BadRequestException for string with letters and numbers', () => {
      expect(() => pipe.transform('123abc', mockMetadata)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for negative number string', () => {
      expect(() => pipe.transform('-123', mockMetadata)).toThrow(BadRequestException);
      expect(() => pipe.transform('-123', mockMetadata)).toThrow(
        'Invalid id: "-123" is not a valid ID. Expected a numeric value.',
      );
    });

    it('should throw BadRequestException for decimal number string', () => {
      expect(() => pipe.transform('123.45', mockMetadata)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for string with spaces', () => {
      expect(() => pipe.transform('123 456', mockMetadata)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for string with special characters', () => {
      expect(() => pipe.transform('123!@#', mockMetadata)).toThrow(BadRequestException);
    });

    it('should use "parameter" as fallback when metadata.data is undefined', () => {
      expect(() => pipe.transform('abc', mockMetadataWithoutData)).toThrow(
        'Invalid parameter: "abc" is not a valid ID. Expected a numeric value.',
      );
    });

    it('should use "parameter" as fallback for empty string when metadata.data is undefined', () => {
      expect(() => pipe.transform('', mockMetadataWithoutData)).toThrow(
        'Invalid parameter: "" is not a valid ID. Expected a numeric value.',
      );
    });
  });
});

