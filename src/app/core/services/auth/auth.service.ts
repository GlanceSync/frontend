import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../shared/interfaces/ApiError';
import { AuthUser } from '../../interfaces/auth/AuthUser';
import { SessionResponse } from '../../interfaces/auth/SessionResponse';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  /** The signed-in user, or null when signed out. Read by the header and the guards. */
  readonly currentUser = signal<AuthUser | null>(null);

  /** True once we have asked the server who we are, so we only ask once per page load. */
  private resolved = false;

  readonly isBrowser = isPlatformBrowser(this.platformId);

  /**
   * The session cookie lives in the browser, so asking "who am I" only makes sense there.
   * During server rendering we report "signed out" and let hydration settle it.
   */
  async ensureResolved(): Promise<AuthUser | null> {
    if (!this.isBrowser) {
      return null;
    }
    if (this.resolved) {
      return this.currentUser();
    }
    try {
      const session = await firstValueFrom(
        this.http.get<SessionResponse>('/api/auth/me', { withCredentials: true })
      );
      // The server omits the field entirely when signed out, so normalise to null.
      this.currentUser.set(session.user ?? null);
    } catch {
      // Only a transport failure lands here; being signed out is a normal 200.
      this.currentUser.set(null);
    }
    this.resolved = true;
    return this.currentUser();
  }

  async register(username: string, password: string, confirmPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post<AuthUser>(
        '/api/auth/register',
        { username, password, confirmPassword },
        { withCredentials: true }
      )
    );
  }

  async login(username: string, password: string): Promise<AuthUser> {
    const user = await firstValueFrom(
      this.http.post<AuthUser>('/api/auth/login', { username, password }, { withCredentials: true })
    );
    this.currentUser.set(user);
    this.resolved = true;
    return user;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post('/api/auth/logout', {}, { withCredentials: true })
      );
    } finally {
      // Whatever the server said, this browser is done with the session.
      this.currentUser.set(null);
      this.resolved = true;
    }
  }

  /** Replaces the profile photo with an image already cropped and sized by the caller. */
  async uploadAvatar(image: Blob): Promise<AuthUser> {
    const user = await firstValueFrom(
      this.http.put<AuthUser>('/api/users/me/avatar', image, {
        withCredentials: true,
        headers: { 'Content-Type': image.type }
      })
    );
    this.currentUser.set(user);
    return user;
  }

  async removeAvatar(): Promise<AuthUser> {
    const user = await firstValueFrom(
      this.http.delete<AuthUser>('/api/users/me/avatar', { withCredentials: true })
    );
    this.currentUser.set(user);
    return user;
  }

  /** Turns an HTTP failure into the API's error shape, with a sane fallback. */
  static toApiError(error: unknown): ApiError {
    if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
      const body = error.error as ApiError;
      if (body.message) {
        return body;
      }
    }
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return { message: 'Cannot reach the server. Is the backend running?' };
    }
    return { message: 'Something went wrong. Please try again.' };
  }
}
