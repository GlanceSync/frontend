import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/toast/toast.service';

@Component({
  selector: 'app-oauth-callback',
  template: `
    <section class="auth-card oauth-callback" aria-live="polite">
      <span class="oauth-spinner" aria-hidden="true"></span>
      <h1>Finishing sign-in</h1>
      <p class="subtitle">Please wait while we securely connect your account.</p>
    </section>
  `
})
export class OAuthCallbackComponent {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  constructor() {
    if (this.auth.isBrowser) void this.complete();
  }

  private async complete(): Promise<void> {
    const provider = this.route.snapshot.paramMap.get('provider');
    const query = this.route.snapshot.queryParamMap;
    if (!provider) {
      await this.fail('The sign-in provider is missing.');
      return;
    }

    try {
      const user = await this.auth.completeOAuth(provider, {
        code: query.get('code') ?? undefined,
        state: query.get('state') ?? undefined,
        error: query.get('error') ?? undefined
      });
      this.toast.success(`Welcome, ${user.username}!`);
      await this.router.navigate([user.profileCompleted ? '/discover' : '/complete-profile']);
    } catch (error) {
      this.toast.apiError(error);
      await this.router.navigate(['/login']);
    }
  }

  private async fail(message: string): Promise<void> {
    this.toast.error(message);
    await this.router.navigate(['/login']);
  }
}
