import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Metadata key used to store required roles for route access.
 * Used by RolesGuard to enforce role-based authorization.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator that restricts route access to users with specific roles.
 * 
 * When applied to a route handler or controller, the RolesGuard will
 * check if the authenticated user has one of the specified roles.
 * Works in conjunction with JwtAuthGuard (must be applied first).
 * 
 * @param roles - One or more UserRole values that are allowed to access the route
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
 * }
 * ```
 * 
 * @example
 * ```typescript
 * @Roles(UserRole.SUPER_ADMIN)
 * @Post('system/settings')
 * async updateSystemSettings(@Body() dto: SettingsDto) {
 *   return this.settingsService.update(dto);
 * }
 * ```
 * 
 * @returns A metadata decorator that stores the required roles
 * 
 * @throws {Error} If no roles are provided
 */
export const Roles = (...roles: UserRole[]) => {
  if (!roles || roles.length === 0) {
    throw new Error('Roles decorator requires at least one role');
  }
  return SetMetadata(ROLES_KEY, roles);
};