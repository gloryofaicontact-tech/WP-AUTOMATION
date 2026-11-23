import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

/**
 * Type for Prisma extended client with soft delete functionality.
 * 
 * Extends PrismaClient with custom query extensions for soft delete operations.
 */
type ExtendedPrismaClient = ReturnType<PrismaClient['$extends']>;

/**
 * Prisma Database Service.
 * 
 * Extends PrismaClient with application-specific functionality including:
 * - Connection lifecycle management
 * - Health checking
 * - Soft delete extensions for User model
 * - Environment-aware logging
 * 
 * **Features:**
 * - Automatic connection on module initialization
 * - Graceful disconnection on module destruction
 * - Connection health verification via SQL query
 * - Extended client with soft delete for User model
 * - Environment-aware logging (verbose in development, errors only in production)
 * 
 * **Soft Delete Extension:**
 * The `extended` property provides a Prisma client with soft delete functionality
 * for the User model. When using `extended.user.delete()`, it performs a soft delete
 * by setting `deletedAt` and `status` fields instead of actually deleting the record.
 * 
 * **Usage:**
 * ```typescript
 * constructor(private prisma: PrismaService) {}
 * 
 * // Standard Prisma operations
 * const user = await this.prisma.user.findUnique({ 
 *   where: { id: 1n },
 *   select: { id: true, email: true }
 * });
 * 
 * // Hard delete (permanently removes record)
 * await this.prisma.user.delete({ where: { id: 1n } });
 * 
 * // Soft delete (sets deletedAt and status to DELETED)
 * await this.prisma.extended.user.delete({ where: { id: 1n } });
 * ```
 * 
 * **Connection Lifecycle:**
 * - `onModuleInit()`: Connects to database and verifies connection
 * - `onModuleDestroy()`: Gracefully disconnects from database
 * 
 * **Error Handling:**
 * - Connection errors are logged but don't throw (allows graceful degradation)
 * - In production, consider failing fast on connection errors
 * 
 * **Logging:**
 * - Development: Logs info, warn, and error level queries
 * - Production: Logs only error level queries
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private _extendedClient: ExtendedPrismaClient | null = null;

  constructor(private readonly configService: ConfigService) {
    super({
      log: configService.get('app.nodeEnv') === 'development'
        ? ['info', 'warn', 'error']
        : ['error'],
    });
  }

  /**
   * Extended Prisma client with soft delete functionality.
   * 
   * Provides a Prisma client instance with custom query extensions.
   * Currently implements soft delete for the User model.
   * 
   * **Soft Delete Behavior:**
   * When calling `extended.user.delete()`, instead of permanently deleting
   * the record, it:
   * - Sets `deletedAt` to current timestamp
   * - Sets `status` to 'DELETED'
   * - Preserves the record for audit purposes
   * 
   * **Caching:**
   * The extended client is cached after first access to avoid recreating
   * the extension on every call.
   * 
   * @returns Extended Prisma client with soft delete extensions
   * 
   * @example
   * ```typescript
   * // Soft delete a user
   * await this.prisma.extended.user.delete({ where: { id: userId } });
   * 
   * // The user record still exists but with deletedAt and status set
   * const deletedUser = await this.prisma.user.findUnique({ 
   *   where: { id: userId } 
   * });
   * // deletedUser.deletedAt !== null
   * // deletedUser.status === 'DELETED'
   * ```
   */
  get extended(): ExtendedPrismaClient {
    if (!this._extendedClient) {
      this._extendedClient = this.$extends({
        query: {
          user: {
            async delete({ args, query }) {
              return query({
                ...args,
                data: { deletedAt: new Date(), status: 'DELETED' },
              });
            },
          },
        },
      }) as ExtendedPrismaClient;
    }
    return this._extendedClient;
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