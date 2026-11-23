import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService, HealthCheckResult, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('HealthController', () => {
    let controller: HealthController;
    let healthCheckService: { check: jest.Mock };
    let prisma: { $queryRaw: jest.Mock };

    beforeEach(async () => {
        healthCheckService = {
            check: jest.fn(),
        };
        prisma = {
            $queryRaw: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [
                { provide: HealthCheckService, useValue: healthCheckService },
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        controller = module.get<HealthController>(HealthController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('check', () => {
        it('should return healthy status when database is up', async () => {
            const mockHealthResult: HealthCheckResult = {
                status: 'ok',
                info: { database: { status: 'up' } },
                error: {},
                details: { database: { status: 'up' } },
            };
            healthCheckService.check.mockResolvedValue(mockHealthResult);

            const result = await controller.check();

            expect(result).toEqual(mockHealthResult);
            expect(healthCheckService.check).toHaveBeenCalled();
        });

        it('should call health check with database indicator', async () => {
            healthCheckService.check.mockImplementation(async (indicators: Array<() => Promise<HealthIndicatorResult>>) => {
                const results = await Promise.all(indicators.map((fn: () => Promise<HealthIndicatorResult>) => fn()));
                return {
                    status: 'ok' as const,
                    info: Object.assign({}, ...results),
                    error: {},
                    details: Object.assign({}, ...results),
                };
            });
            prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

            const result = await controller.check();

            expect(result.info).toHaveProperty('database');
            expect((result.info as any).database.status).toBe('up');
        });

        it('should return down status when database query fails', async () => {
            healthCheckService.check.mockImplementation(async (indicators: Array<() => Promise<HealthIndicatorResult>>) => {
                const results = await Promise.all(indicators.map((fn: () => Promise<HealthIndicatorResult>) => fn()));
                return {
                    status: 'error' as const,
                    info: {},
                    error: Object.assign({}, ...results),
                    details: Object.assign({}, ...results),
                };
            });
            prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

            const result = await controller.check();

            expect(result.error).toHaveProperty('database');
            expect((result.error as any).database.status).toBe('down');
        });
    });
});
