import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

jest.mock('@prisma/client', () => {
    return {
        PrismaClient: class MockPrismaClient {
            $connect = jest.fn().mockResolvedValue(undefined);
            $disconnect = jest.fn().mockResolvedValue(undefined);
            $queryRaw = jest.fn().mockResolvedValue([{ 1: 1 }]);
            $extends = jest.fn().mockReturnValue({ mocked: true });
        },
    };
});

describe('PrismaService', () => {
    let service: PrismaService;
    let configService: ConfigService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PrismaService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockReturnValue('test'),
                    },
                },
            ],
        }).compile();

        service = module.get<PrismaService>(PrismaService);
        configService = module.get<ConfigService>(ConfigService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });
    });

    describe('onModuleInit', () => {
        it('should connect to database and log success', async () => {
            const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

            await service.onModuleInit();

            expect(service.$connect).toHaveBeenCalled();
            expect(service.$queryRaw).toHaveBeenCalled();
        });

        it('should handle database connection failure', async () => {
            const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
            (service.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

            await service.onModuleInit();

            expect(errorSpy).toHaveBeenCalledWith('Database connection failed', expect.any(Error));
        });
    });

    describe('onModuleDestroy', () => {
        it('should disconnect from database', async () => {
            const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

            await service.onModuleDestroy();

            expect(service.$disconnect).toHaveBeenCalled();
        });
    });

    describe('extended', () => {
        it('should return extended client', () => {
            const result = service.extended;

            expect(result).toBeDefined();
            expect(service.$extends).toHaveBeenCalled();
        });

        it('should cache extended client on subsequent calls', () => {
            const result1 = service.extended;
            const result2 = service.extended;

            expect(result1).toBe(result2);
            expect(service.$extends).toHaveBeenCalledTimes(1);
        });
    });
});
