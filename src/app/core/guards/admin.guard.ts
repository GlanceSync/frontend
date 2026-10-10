import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

/** The moderation pages. The server checks the role too; this only keeps others out of the UI. */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isBrowser) {
    return true;
  }

  const user = await auth.ensureResolved();
  if (!user) {
    return router.createUrlTree(['/login']);
  }
  return user.role === 'ADMIN' ? true : router.createUrlTree(['/discover']);
};
