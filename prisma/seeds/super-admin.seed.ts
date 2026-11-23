import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Logger } from 'winston';

export const seedSuperAdmin = async (prisma: PrismaClient, logger: Logger) => {
    const email = process.env.SEED_ADMIN_EMAIL || 'superadmin@gmail.com';
    const password = process.env.SEED_ADMIN_PASSWORD || 'admin123';
    const fullName = process.env.SEED_ADMIN_FULL_NAME || 'Super Admin';

    logger.info(`Checking for Super Admin account: ${email}`);

    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        logger.warn('Super Admin already exists. Skipping creation.');
        return;
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await prisma.$transaction(async (tx) => {
        const superAdmin = await tx.user.create({
            data: {
                email,
                passwordHash,
                fullName,
                role: UserRole.SUPER_ADMIN,
                status: UserStatus.ACTIVE,
                emailVerifiedAt: new Date(),
            },
        });

        await tx.auditLog.create({
            data: {
                userId: superAdmin.id,
                action: 'SYSTEM_INIT_SUPER_ADMIN',
                entity: 'User',
                entityId: superAdmin.id,
                ipAddress: '127.0.0.1',
                details: {
                    message: 'Initial Super Admin created via seeding script',
                },
            },
        });

        logger.info('Super Admin created successfully!');
        logger.info(`Email: ${superAdmin.email}`);

        if (process.env.NODE_ENV === 'development') {
            logger.info(`Password: (As defined in .env or default)`);
        }
    });
};
