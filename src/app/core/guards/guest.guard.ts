import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth/auth.service';

/** Keeps a signed-in user away from the login and register pages. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isBrowser) {
    return true;
  }

  const user = await auth.ensureResolved();
  return user
    ? router.createUrlTree([user.profileCompleted ? '/discover' : '/complete-profile'])
    : true;
};
