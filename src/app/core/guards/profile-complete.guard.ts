import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

/** Main app routes require both a valid session and a completed matching profile. */
export const profileCompleteGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isBrowser) {
    return true;
  }

  const user = await auth.ensureResolved();
  if (!user) {
    return router.createUrlTree(['/login']);
  }
  return user.profileCompleted ? true : router.createUrlTree(['/complete-profile']);
};

/** The onboarding form is only for authenticated accounts which are not complete yet. */
export const incompleteProfileGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isBrowser) {
    return true;
  }

  const user = await auth.ensureResolved();
  if (!user) {
    return router.createUrlTree(['/login']);
  }
  return user.profileCompleted ? router.createUrlTree(['/discover']) : true;
};
