import { SetMetadata } from '@nestjs/common';
import { Role } from '@sahara/shared';

export const ROLES_KEY = 'roles';

/** Marks a route as requiring one of the given staff roles. Pair with RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
