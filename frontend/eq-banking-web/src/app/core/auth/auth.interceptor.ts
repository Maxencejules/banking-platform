import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../api/api-config';
import { AuthService } from './auth.service';

/** Public auth endpoints: a 401 there means bad credentials, not an expired session. */
const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register'];

function isPublicAuthRequest(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  return PUBLIC_AUTH_PATHS.some((suffix) => path.endsWith(suffix));
}

/**
 * Adds `Authorization: Bearer <token>` to API requests and signs the user out when the
 * API answers 401 (expired/invalid token). The token is never sent to other origins.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const apiBaseUrl = inject(API_BASE_URL);

  const isApiRequest = req.url.startsWith(`${apiBaseUrl}/`) || req.url === apiBaseUrl;
  const token = auth.token();
  const request =
    isApiRequest && token && !req.headers.has('Authorization')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiRequest &&
        !isPublicAuthRequest(req.url)
      ) {
        // Only react once per session: concurrent 401s (or a stale response after a new
        // sign-in) must not trigger repeated redirects.
        if (token && auth.token() === token) {
          auth.logout({ reason: 'expired', returnUrl: router.url });
        }
      }
      return throwError(() => error);
    }),
  );
};
