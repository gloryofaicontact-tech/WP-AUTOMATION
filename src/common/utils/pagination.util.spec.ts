import { paginate, paginatePageToken } from './pagination.util';
import { PaginationDto } from '../dto/pagination.dto';
import { PageTokenPaginationDto } from '../dto/page-token-pagination.dto';

describe('PaginationUtil', () => {
    const createMockModel = (data: any[], total: number) => ({
        findMany: jest.fn().mockResolvedValue(data),
        count: jest.fn().mockResolvedValue(total),
    });

    describe('paginate', () => {
        it('should return paginated results with default values', async () => {
            const mockData = [{ id: 1 }, { id: 2 }];
            const model = createMockModel(mockData, 20);
            const paginationDto: PaginationDto = {};

            const result = await paginate(model, paginationDto);

            expect(result).toEqual({
                data: mockData,
                meta: {
                    total: 20,
                    lastPage: 2,
                    currentPage: 1,
                    perPage: 10,
                    prev: null,
                    next: 2,
                },
            });
            expect(model.findMany).toHaveBeenCalledWith({ skip: 0, take: 10 });
        });

        it('should use provided page and limit', async () => {
            const mockData = [{ id: 11 }, { id: 12 }];
            const model = createMockModel(mockData, 50);
            const paginationDto: PaginationDto = { page: 2, limit: 5 };

            const result = await paginate(model, paginationDto);

            expect(result.meta.currentPage).toBe(2);
            expect(result.meta.perPage).toBe(5);
            expect(result.meta.lastPage).toBe(10);
            expect(model.findMany).toHaveBeenCalledWith({ skip: 5, take: 5 });
        });

        it('should calculate prev correctly on page > 1', async () => {
            const model = createMockModel([], 30);
            const paginationDto: PaginationDto = { page: 3, limit: 10 };

            const result = await paginate(model, paginationDto);

            expect(result.meta.prev).toBe(2);
        });

        it('should set prev to null on first page', async () => {
            const model = createMockModel([], 30);
            const paginationDto: PaginationDto = { page: 1, limit: 10 };

            const result = await paginate(model, paginationDto);

            expect(result.meta.prev).toBeNull();
        });

        it('should calculate next correctly when not on last page', async () => {
            const model = createMockModel([], 30);
            const paginationDto: PaginationDto = { page: 1, limit: 10 };

            const result = await paginate(model, paginationDto);

            expect(result.meta.next).toBe(2);
        });

        it('should set next to null on last page', async () => {
            const model = createMockModel([], 30);
            const paginationDto: PaginationDto = { page: 3, limit: 10 };

            const result = await paginate(model, paginationDto);

            expect(result.meta.next).toBeNull();
        });

        it('should pass where clause to count', async () => {
            const model = createMockModel([], 10);
            const paginationDto: PaginationDto = { page: 1, limit: 10 };
            const args = { where: { status: 'active' } };

            await paginate(model, paginationDto, args);

            expect(model.count).toHaveBeenCalledWith({ where: { status: 'active' } });
        });

        it('should handle empty results', async () => {
            const model = createMockModel([], 0);
            const paginationDto: PaginationDto = { page: 1, limit: 10 };

            const result = await paginate(model, paginationDto);

            expect(result.data).toEqual([]);
            expect(result.meta.total).toBe(0);
            expect(result.meta.lastPage).toBe(0);
            expect(result.meta.next).toBeNull();
        });

        it('should handle string page and limit values', async () => {
            const model = createMockModel([], 100);
            const paginationDto = { page: '2' as any, limit: '20' as any };

            const result = await paginate(model, paginationDto);

            expect(result.meta.currentPage).toBe(2);
            expect(result.meta.perPage).toBe(20);
            expect(model.findMany).toHaveBeenCalledWith({ skip: 20, take: 20 });
        });

        it('should default to page 1 and limit 10 for invalid values', async () => {
            const model = createMockModel([], 50);
            const paginationDto = { page: undefined, limit: undefined };

            const result = await paginate(model, paginationDto);

            expect(result.meta.currentPage).toBe(1);
            expect(result.meta.perPage).toBe(10);
        });
    });

    describe('paginatePageToken', () => {
        it('should return page token-paginated results without page_token (first page)', async () => {
            const mockData = [
                { id: '1', name: 'Item 1' },
                { id: '2', name: 'Item 2' },
                { id: '3', name: 'Item 3' },
            ];
            const model = {
                findMany: jest.fn().mockResolvedValue(mockData),
                count: jest.fn().mockResolvedValue(100),
            };
            const paginationDto: PageTokenPaginationDto = { limit: 2 };

            const result = await paginatePageToken(model, paginationDto, { orderBy: { id: 'asc' } }, 'id');

            expect(result.data).toHaveLength(2);
            expect(result.data[0].id).toBe('1');
            expect(result.data[1].id).toBe('2');
            expect(result.meta.next_page_token).toBe('2');
            expect(result.meta.hasMore).toBe(true);
            expect(result.meta.limit).toBe(2);
            expect(model.findMany).toHaveBeenCalledWith({
                orderBy: { id: 'asc' },
                take: 3, // limit + 1
            });
        });

        it('should return page token-paginated results with page_token (subsequent page)', async () => {
            const mockData = [
                { id: '3', name: 'Item 3' },
                { id: '4', name: 'Item 4' },
                { id: '5', name: 'Item 5' },
            ];
            const model = {
                findMany: jest.fn().mockResolvedValue(mockData),
            };
            const paginationDto: PageTokenPaginationDto = { limit: 2, page_token: '2' };

            const result = await paginatePageToken(model, paginationDto, { orderBy: { id: 'asc' } }, 'id');

            expect(result.data).toHaveLength(2);
            expect(result.data[0].id).toBe('3');
            expect(result.data[1].id).toBe('4');
            expect(result.meta.next_page_token).toBe('4');
            expect(result.meta.hasMore).toBe(true);
            expect(model.findMany).toHaveBeenCalledWith({
                orderBy: { id: 'asc' },
                take: 3,
                where: { id: { gt: '2' } },
            });
        });

        it('should return hasMore false when no more items', async () => {
            const mockData = [
                { id: '9', name: 'Item 9' },
                { id: '10', name: 'Item 10' },
            ];
            const model = {
                findMany: jest.fn().mockResolvedValue(mockData),
            };
            const paginationDto: PageTokenPaginationDto = { limit: 2, page_token: '8' };

            const result = await paginatePageToken(model, paginationDto, { orderBy: { id: 'asc' } }, 'id');

            expect(result.data).toHaveLength(2);
            expect(result.meta.next_page_token).toBeNull();
            expect(result.meta.hasMore).toBe(false);
        });

        it('should handle descending order correctly', async () => {
            const mockData = [
                { id: '5', name: 'Item 5' },
                { id: '4', name: 'Item 4' },
            ];
            const model = {
                findMany: jest.fn().mockResolvedValue(mockData),
            };
            const paginationDto: PageTokenPaginationDto = { limit: 2, page_token: '6' };

            const result = await paginatePageToken(model, paginationDto, { orderBy: { id: 'desc' } }, 'id');

            expect(result.meta.next_page_token).toBeNull();
            expect(result.meta.hasMore).toBe(false);
            expect(model.findMany).toHaveBeenCalledWith({
                orderBy: { id: 'desc' },
                take: 3,
                where: { id: { lt: '6' } },
            });
        });

        it('should include total count on first page when count method available', async () => {
            const mockData = [{ id: '1' }, { id: '2' }];
            const model = {
                findMany: jest.fn().mockResolvedValue(mockData),
                count: jest.fn().mockResolvedValue(100),
            };
            const paginationDto: PageTokenPaginationDto = { limit: 2 };

            const result = await paginatePageToken(model, paginationDto, { orderBy: { id: 'asc' } }, 'id');

            expect(result.meta.total).toBe(100);
            expect(model.count).toHaveBeenCalledWith({ where: undefined });
        });

        it('should not include total count when page_token is provided', async () => {
            const mockData = [{ id: '3' }, { id: '4' }];
            const model = {
                findMany: jest.fn().mockResolvedValue(mockData),
                count: jest.fn().mockResolvedValue(100),
            };
            const paginationDto: PageTokenPaginationDto = { limit: 2, page_token: '2' };

            const result = await paginatePageToken(model, paginationDto, { orderBy: { id: 'asc' } }, 'id');

            expect(result.meta.total).toBeUndefined();
            expect(model.count).not.toHaveBeenCalled();
        });

        it('should handle custom token field', async () => {
            const mockData = [
                { createdAt: '2024-01-01T00:00:00Z', name: 'Item 1' },
                { createdAt: '2024-01-02T00:00:00Z', name: 'Item 2' },
            ];
            const model = {
                findMany: jest.fn().mockResolvedValue(mockData),
            };
            const paginationDto: PageTokenPaginationDto = { limit: 2 };

            const result = await paginatePageToken(
                model,
                paginationDto,
                { orderBy: { createdAt: 'asc' } },
                'createdAt'
            );

            expect(result.meta.next_page_token).toBeNull();
            expect(result.meta.hasMore).toBe(false);
        });

        it('should handle where clause with page_token', async () => {
            const mockData = [{ id: '3', status: 'active' }];
            const model = {
                findMany: jest.fn().mockResolvedValue(mockData),
            };
            const paginationDto: PageTokenPaginationDto = { limit: 1, page_token: '2' };

            await paginatePageToken(
                model,
                paginationDto,
                {
                    where: { status: 'active' },
                    orderBy: { id: 'asc' },
                },
                'id'
            );

            expect(model.findMany).toHaveBeenCalledWith({
                where: {
                    status: 'active',
                    id: { gt: '2' },
                },
                orderBy: { id: 'asc' },
                take: 2,
            });
        });

        it('should default limit to 10 when not provided', async () => {
            const mockData = Array.from({ length: 11 }, (_, i) => ({ id: String(i + 1) }));
            const model = {
                findMany: jest.fn().mockResolvedValue(mockData),
            };
            const paginationDto: PageTokenPaginationDto = {};

            const result = await paginatePageToken(model, paginationDto, { orderBy: { id: 'asc' } }, 'id');

            expect(result.meta.limit).toBe(10);
            expect(result.meta.hasMore).toBe(true);
            expect(model.findMany).toHaveBeenCalledWith({
                orderBy: { id: 'asc' },
                take: 11, // limit + 1
            });
        });

        it('should enforce maximum limit of 100', async () => {
            const mockData = Array.from({ length: 101 }, (_, i) => ({ id: String(i + 1) }));
            const model = {
                findMany: jest.fn().mockResolvedValue(mockData),
            };
            const paginationDto: PageTokenPaginationDto = { limit: 150 };

            const result = await paginatePageToken(model, paginationDto, { orderBy: { id: 'asc' } }, 'id');

            expect(result.meta.limit).toBe(100);
            expect(model.findMany).toHaveBeenCalledWith({
                orderBy: { id: 'asc' },
                take: 101, // 100 + 1
            });
        });
    });
});
