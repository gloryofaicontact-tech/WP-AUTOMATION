import { PrismaClient } from '@prisma/client';
import * as winston from 'winston';
import { seedSuperAdmin } from './seeds/super-admin.seed';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level}]: ${message}`;
        }),
    ),
    transports: [new winston.transports.Console()],
});

const prisma = new PrismaClient();

async function main() {
    const seedEnabled = process.env.SEED_DATABASE === 'true';

    if (!seedEnabled) {
        logger.info('Database seeding is disabled. Set SEED_DATABASE=true to enable.');
        return;
    }

    logger.info('Starting database seeding process...');

    try {
        await seedSuperAdmin(prisma, logger);
       
    } catch (e) {
        logger.error(`Seeding failed with error: ${e instanceof Error ? e.message : e}`);
        process.exit(1);
    }

    logger.info('Seeding completed successfully.');
}

main()
    .catch((e) => {
        throw e;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });