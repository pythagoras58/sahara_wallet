import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@sahara/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Expects an upstream auth guard to have populated `request.user.role`.
 * Routes with no @Roles() decorator are allowed through unchanged.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const userRole: Role | undefined = request.user?.role;
    return !!userRole && requiredRoles.includes(userRole);
  }
}
