import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { Permission } from './permissions';

// Reads the allowed permissions from the route: data: { permissions: [...] }
// The user needs AT LEAST ONE of them.
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  const required = (route.data['permissions'] ?? []) as Permission[];

  if (required.length === 0 || auth.hasAnyPermission(required)) {
    return true;
  }
  return router.createUrlTree(['/unauthorized']);
};
