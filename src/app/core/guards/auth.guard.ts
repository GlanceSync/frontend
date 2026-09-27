import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth/auth.service';

/** Blocks a route unless a session exists. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // No cookie is available during server rendering, so allow the render and let
  // the browser re-run this guard on hydration.
  if (!auth.isBrowser) {
    return true;
  }

  const user = await auth.ensureResolved();
  return user ? true : router.createUrlTree(['/login']);
};
