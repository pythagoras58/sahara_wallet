import { Role } from '@sahara/shared';

export type PrincipalKind = 'user' | 'staff';

export interface JwtPayload {
  sub: string;
  role: Role;
  kind: PrincipalKind;
}

/** Shape attached to `request.user` by JwtStrategy. Consumed by RolesGuard. */
export interface AuthenticatedPrincipal {
  id: string;
  role: Role;
  kind: PrincipalKind;
}
