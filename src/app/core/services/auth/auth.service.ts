import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../shared/interfaces/ApiError';
import { AuthUser } from '../../interfaces/auth/AuthUser';
import { AuthResponse } from '../../interfaces/auth/AuthResponse';
import { RegisterRequest } from '../../interfaces/auth/RegisterRequest';

const EXPIRY_MARGIN_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  readonly currentUser = signal<AuthUser | null>(null);

  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  private resolved = false;

  private refreshing: Promise<string | null> | null = null;

  readonly isBrowser = isPlatformBrowser(this.platformId);

  token(): string | null {
    return this.accessToken;
  }

  async ensureResolved(): Promise<AuthUser | null> {
    if (!this.isBrowser) {
      return null;
    }
    if (!this.resolved) {
      await this.refresh();
      this.resolved = true;
    }
    return this.currentUser();
  }

  async freshToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt - EXPIRY_MARGIN_MS) {
      return this.accessToken;
    }
    return this.refresh();
  }

  refresh(): Promise<string | null> {
    this.refreshing ??= firstValueFrom(
      this.http.post<AuthResponse>('/api/auth/refresh', {}, { withCredentials: true })
    )
      .then(response => {
        this.acceptTokens(response);
        return response.accessToken;
      })
      .catch(() => {
        this.clearSession();
        return null;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  async register(request: RegisterRequest): Promise<void> {
    await firstValueFrom(this.http.post<AuthUser>('/api/auth/register', request));
  }

  async login(username: string, password: string): Promise<AuthUser> {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>('/api/auth/login', { username, password }, { withCredentials: true })
    );
    this.acceptTokens(response);
    this.resolved = true;
    return response.user;
  }

  async resendVerification(email: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/resend-verification', { email }));
  }

  async forgotPassword(email: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/forgot-password', { email }));
  }

  async resetPassword(token: string, password: string, confirmPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post('/api/auth/reset-password', { token, password, confirmPassword })
    );
  }

  setProfileCompleted(completed: boolean): void {
    const user = this.currentUser();
    if (user) {
      this.currentUser.set({ ...user, profileCompleted: completed });
    }
  }

  syncProfileState(profile: { avatarUrl?: string | null; completed?: boolean | null }): void {
    const user = this.currentUser();
    if (user) {
      this.currentUser.set({
        ...user,
        avatarUrl: profile.avatarUrl ?? null,
        profileCompleted: Boolean(profile.completed)
      });
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}, { withCredentials: true }));
    } finally {
      // Whatever the server said, this browser is done with the session.
      this.clearSession();
      this.resolved = true;
    }
  }

  async uploadAvatar(image: Blob): Promise<AuthUser> {
    const user = await firstValueFrom(
      this.http.put<AuthUser>('/api/users/me/avatar', image, {
        headers: { 'Content-Type': image.type }
      })
    );
    this.currentUser.set(user);
    return user;
  }

  async removeAvatar(): Promise<AuthUser> {
    const user = await firstValueFrom(this.http.delete<AuthUser>('/api/users/me/avatar'));
    this.currentUser.set(user);
    return user;
  }

  private acceptTokens(response: AuthResponse): void {
    this.accessToken = response.accessToken;
    this.accessTokenExpiresAt = Date.now() + response.expiresIn * 1000;
    this.currentUser.set(response.user);
  }

  private clearSession(): void {
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
    this.currentUser.set(null);
  }

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
