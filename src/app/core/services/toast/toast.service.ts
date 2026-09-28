import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Toast, ToastKind } from '../../interfaces/toast/Toast';
import { AuthService } from '../auth/auth.service';

/**
 * App-wide success and error messages. Any component can raise one; the single
 * <app-toast> in the shell renders them, so feedback survives route changes.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  /** Errors linger longer: they usually need reading, a success only needs noticing. */
  private static readonly DURATION: Record<ToastKind, number> = { success: 3500, error: 6000 };
  private static readonly MAX_VISIBLE = 4;

  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  /**
   * Shows what a failed API call said. When the server attached messages to specific
   * fields ("username taken", "password too common") each gets its own toast;
   * otherwise its general message is shown.
   */
  apiError(error: unknown): void {
    const apiError = AuthService.toApiError(error);
    const fieldMessages = Object.values(apiError.fields ?? {});
    (fieldMessages.length ? fieldMessages : [apiError.message]).forEach(message => this.error(message));
  }

  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(kind: ToastKind, message: string): void {
    // Skipped during SSR: a server-rendered toast would never auto-dismiss, and the
    // client raises the same toast again once it boots.
    if (!this.isBrowser) {
      return;
    }

    const toast: Toast = { id: ++this.nextId, kind, message };

    // Drop the oldest rather than stacking toasts down the whole screen.
    const overflow = this._toasts().length + 1 - ToastService.MAX_VISIBLE;
    this._toasts().slice(0, Math.max(0, overflow)).forEach((t) => this.dismiss(t.id));

    this._toasts.update((list) => [...list, toast]);
    this.timers.set(toast.id, setTimeout(() => this.dismiss(toast.id), ToastService.DURATION[kind]));
  }
}
