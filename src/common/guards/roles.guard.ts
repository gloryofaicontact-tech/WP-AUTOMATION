import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRole } from '@prisma/client';

/**
 * Role-based Authorization Guard.
 * 
 * Restricts route access based on user roles. Requires JwtAuthGuard to run first
 * to authenticate the user and set request.user. Routes can be marked as public
 * using @Public() decorator to bypass role checks.
 * 
 * This guard:
 * - Checks if route is public (bypasses role check)
 * - Checks if route requires specific roles via @Roles() decorator
 * - Validates that the authenticated user has one of the required roles
 * - Throws ForbiddenException if user lacks required role
 * - Provides comprehensive error handling and security logging
 * 
 * Usage:
 * - Apply @Roles(UserRole.ADMIN) to restrict to specific roles
 * - Works with @Public() decorator (bypasses role check)
 * - Requires JwtAuthGuard to run first (sets request.user)
 * 
 * @example
 * ```typescript
 * @Controller('admin')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * export class AdminController {
 *   @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
 *   @Delete('users/:id')
 *   async deleteUser(@Param('id') id: string) {
 *     return this.usersService.delete(id);
 *   }
 * 
 *   @Roles(UserRole.SUPER_ADMIN)
 *   @Post('system/settings')
 *   async updateSystemSettings(@Body() dto: SettingsDto) {
 *     return this.settingsService.update(dto);
 *   }
 * }
 * ```
 * 
 * @example
 * ```typescript
 * @Controller('users')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * export class UsersController {
 *   @Public()
 *   @Get('public')
 *   async publicRoute() {
 *     return { message: 'Public route' };
 *   }
 * 
 *   @Roles(UserRole.USER, UserRole.ADMIN)
 *   @Get('profile')
 *   async getProfile(@CurrentUser() user: User) {
 *     return user;
 *   }
 * }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
    private readonly logger = new Logger(RolesGuard.name);

    constructor(private reflector: Reflector) { }

    /**
     * Determines if the route can be activated based on user roles.
     * 
     * @param context - Execution context containing route handler and class metadata
     * @returns true if user has required role or route is public
     * @throws {UnauthorizedException} If user is not authenticated
     * @throws {ForbiddenException} If user does not have required role
     */
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const route = `${request.method} ${request.url}`;
        const ip = request.ip || request.connection?.remoteAddress || 'unknown';

        // Check if route is marked as public
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        
        if (isPublic) {
            return true;
        }

        // Get required roles from decorator metadata
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // No roles required - allow access
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        // Get authenticated user from request (set by JwtAuthGuard)
        const { user } = request;

        // User must be authenticated (set by JwtAuthGuard)
        if (!user) {
            this.logger.warn(
                `[${route}] Authorization failed - User not authenticated (IP: ${ip})`
            );
            throw new UnauthorizedException('User not authenticated. Please login to access this resource.');
        }

        // Validate user object has required properties
        if (!user.role || typeof user.role !== 'string') {
            this.logger.error(
                `[${route}] Invalid user object - missing or invalid role property (User ID: ${user.id || 'unknown'})`
            );
            throw new UnauthorizedException('Invalid user session. Please login again.');
        }

        // Check if user has one of the required roles
        const hasRole = requiredRoles.some((role) => user.role === role);

        if (!hasRole) {
            const userRole = user.role || 'unknown';
            const userId = user.id || 'unknown';
            const requiredRolesStr = requiredRoles.join(', ');
            
            // Log authorization failures for security monitoring
            this.logger.warn(
                `[${route}] Authorization denied - User ${userId} (Role: ${userRole}) attempted to access route requiring: ${requiredRolesStr} (IP: ${ip})`
            );

            throw new ForbiddenException(
                `Access denied. This resource requires one of the following roles: ${requiredRolesStr}. Your current role: ${userRole}.`
            );
        }

        // Log successful authorization for audit trail (optional, can be verbose)
        // this.logger.debug(`[${route}] Authorization granted - User ${user.id} (Role: ${user.role})`);

        return true;
    }
}