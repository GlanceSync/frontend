import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth/auth.service';

/** Endpoints that work without an access token; a 401 from them is a real answer. */
const TOKENLESS = /^\/api\/auth\/(login|register|refresh|logout|verify-email|resend-verification)$/;

function withToken(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/') || TOKENLESS.test(request.url)) {
    return next(request);
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  return next(withToken(request, auth.token())).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !auth.isBrowser) {
        return throwError(() => error);
      }
      return from(auth.refresh()).pipe(
        switchMap(token => {
          if (!token) {
            void router.navigate(['/login']);
            return throwError(() => error);
          }
          return next(withToken(request, token));
        })
      );
    })
  );
};
