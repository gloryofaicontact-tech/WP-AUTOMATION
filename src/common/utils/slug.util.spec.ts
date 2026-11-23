import {
  slugify,
  ensureUniqueSlug,
  createWithUniqueSlug,
  SLUG_MAX_LENGTH,
} from './slug.util';

describe('slugify', () => {
  describe('basic transformation', () => {
    it('should convert title to slug', () => {
      expect(slugify('My Ad Title')).toBe('my-ad-title');
    });

    it('should handle special characters', () => {
      expect(slugify('Electronics & Gadgets')).toBe('electronics-and-gadgets');
    });

    it('should handle multiple spaces', () => {
      expect(slugify('Hello   World')).toBe('hello-world');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(slugify('---Hello World---')).toBe('hello-world');
    });

    it('should handle mixed case', () => {
      expect(slugify('Hello WORLD')).toBe('hello-world');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(slugify('')).toBe('item');
    });

    it('should handle only special characters', () => {
      expect(slugify('!!!')).toBe('item');
      expect(slugify('---')).toBe('item');
    });

    it('should handle null/undefined', () => {
      expect(slugify(null as any)).toBe('item');
      expect(slugify(undefined as any)).toBe('item');
    });

    it('should handle very long strings (default max 220)', () => {
      const long = 'a'.repeat(500);
      const result = slugify(long);
      expect(result.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
      expect(SLUG_MAX_LENGTH).toBe(220);
    });

    it('should respect custom maxLength', () => {
      const long = 'a'.repeat(500);
      const result = slugify(long, { maxLength: 100 });
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });

  describe('with unique suffix', () => {
    it('should append unique suffix', () => {
      const result = slugify('Hello World', { addUniqueSuffix: true });
      expect(result).toMatch(/^hello-world-[a-z0-9]+-[a-z0-9]{3}$/);
    });

    it('should handle empty string with suffix', () => {
      const result = slugify('', { addUniqueSuffix: true });
      expect(result).toMatch(/^item-[a-z0-9]+-[a-z0-9]{3}$/);
    });

    it('should respect maxLength with suffix', () => {
      const long = 'a'.repeat(500);
      const result = slugify(long, { addUniqueSuffix: true, maxLength: 50 });
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });

  describe('uniqueness', () => {
    it('should generate different suffixes for same input', () => {
      const slug1 = slugify('Test', { addUniqueSuffix: true });
      // Wait 1ms to ensure different timestamp
      const slug2 = slugify('Test', { addUniqueSuffix: true });
      expect(slug1).not.toBe(slug2);
    });
  });
});

describe('ensureUniqueSlug', () => {
  it('should return base slug if not exists', async () => {
    const exists = jest.fn().mockResolvedValue(false);
    const result = await ensureUniqueSlug('test-slug', exists);
    expect(result).toBe('test-slug');
    expect(exists).toHaveBeenCalledTimes(1);
  });

  it('should append counter if exists', async () => {
    const exists = jest.fn()
      .mockResolvedValueOnce(true)  // base slug exists
      .mockResolvedValueOnce(false); // slug-1 does not exist
    const result = await ensureUniqueSlug('test-slug', exists);
    expect(result).toBe('test-slug-1');
    expect(exists).toHaveBeenCalledTimes(2);
  });

  it('should increment counter until unique', async () => {
    const exists = jest.fn()
      .mockResolvedValueOnce(true)  // base exists
      .mockResolvedValueOnce(true)   // slug-1 exists
      .mockResolvedValueOnce(true)   // slug-2 exists
      .mockResolvedValueOnce(false); // slug-3 does not exist
    const result = await ensureUniqueSlug('test-slug', exists);
    expect(result).toBe('test-slug-3');
  });

  it('should throw error on empty base slug', async () => {
    const exists = jest.fn();
    await expect(ensureUniqueSlug('', exists)).rejects.toThrow('Base slug cannot be empty');
    await expect(ensureUniqueSlug('   ', exists)).rejects.toThrow('Base slug cannot be empty');
  });

  it('should throw error if counter exceeds limit', async () => {
    const exists = jest.fn().mockResolvedValue(true); // Always exists
    await expect(ensureUniqueSlug('test-slug', exists)).rejects.toThrow(
      'Failed to generate unique slug after',
    );
  });
});

describe('createWithUniqueSlug', () => {
  it('should create record with generated slug', async () => {
    const createRecord = jest.fn().mockResolvedValue({ id: 1, slug: 'test-slug-abc' });
    const result = await createWithUniqueSlug(
      () => 'test-slug-abc',
      createRecord,
    );
    expect(result).toEqual({ id: 1, slug: 'test-slug-abc' });
    expect(createRecord).toHaveBeenCalledTimes(1);
    expect(createRecord).toHaveBeenCalledWith('test-slug-abc');
  });

  it('should retry on unique constraint violation', async () => {
    const createRecord = jest.fn()
      .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['slug'] } }) // First attempt fails
      .mockResolvedValueOnce({ id: 1, slug: 'test-slug-def' }); // Second succeeds
    const generateSlug = jest.fn()
      .mockReturnValueOnce('test-slug-abc')
      .mockReturnValueOnce('test-slug-def');
    const result = await createWithUniqueSlug(generateSlug, createRecord);
    expect(result).toEqual({ id: 1, slug: 'test-slug-def' });
    expect(createRecord).toHaveBeenCalledTimes(2);
  });

  it('should throw non-unique constraint errors immediately', async () => {
    const createRecord = jest.fn().mockRejectedValue(new Error('Database connection failed'));
    await expect(
      createWithUniqueSlug(() => 'test-slug', createRecord),
    ).rejects.toThrow('Database connection failed');
  });

  it('should throw error after max retries', async () => {
    const createRecord = jest.fn().mockRejectedValue({
      code: 'P2002',
      meta: { target: ['slug'] },
    });
    await expect(
      createWithUniqueSlug(() => 'test-slug', createRecord, 2),
    ).rejects.toThrow('Failed to create record with unique slug after 2 attempts');
  });
});
