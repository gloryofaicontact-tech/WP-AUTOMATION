import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

/**
 * Type for Prisma extended client with soft delete functionality.
 * 
 * Extends PrismaClient with custom query extensions for soft delete operations.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    super({
      log: configService.get('app.nodeEnv') === 'development'
        ? ['info', 'warn', 'error']
        : ['error'],
    });
  }

  /**
   * Initializes database connection and verifies connectivity.
   * 
   * Called automatically by NestJS when the module is initialized.
   * Connects to the database and performs a health check query.
   * 
   * **Process:**
   * 1. Connects to database via `$connect()`
   * 2. Logs connection attempt
   * 3. Performs health check query (`SELECT 1`)
   * 4. Logs success or failure
   * 
   * **Error Handling:**
   * - Connection errors are logged but don't throw exceptions
   * - Allows application to start even if database is temporarily unavailable
   * - Consider failing fast in production environments
   * 
   * @throws Never throws - errors are logged only
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Checking database connection...');
      await this.$queryRaw`SELECT 1`;
      this.logger.log('Database connected successfully');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Database connection failed: ${errorMsg}`);
      // In production, consider throwing to fail fast
      // if (this.configService.get('app.nodeEnv') === 'production') {
      //   throw new Error(`Database connection failed: ${errorMsg}`);
      // }
    }
  }

  /**
   * Gracefully disconnects from the database.
   * 
   * Called automatically by NestJS when the module is destroyed.
   * Ensures clean database connection closure.
   * 
   * **Process:**
   * 1. Disconnects from database via `$disconnect()`
   * 2. Logs disconnection
   * 
   * **Error Handling:**
   * - Disconnection errors are handled by PrismaClient internally
   * - Method always completes successfully
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}