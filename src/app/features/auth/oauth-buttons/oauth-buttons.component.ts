import { Component, inject, input, signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-oauth-buttons',
  templateUrl: './oauth-buttons.component.html'
})
export class OAuthButtonsComponent {
  private readonly auth = inject(AuthService);

  readonly mode = input<'login' | 'register'>('login');
  readonly providers = signal<string[]>([]);
  readonly loading = signal(true);
  readonly unavailable = signal(false);

  constructor() {
    if (this.auth.isBrowser) {
      void this.load();
    } else {
      this.loading.set(false);
    }
  }

  start(provider: string): void {
    this.auth.beginOAuth(provider);
  }

  label(provider: string): string {
    if (provider === '42') return 'Intra';
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }

  mark(provider: string): string {
    if (provider === 'google') return 'G';
    if (provider === 'facebook') return 'f';
    if (provider === '42') return '42';
    return provider.charAt(0).toUpperCase();
  }

  logo(provider: string): string | null {
    switch (provider) {
      case 'google': return '/assets/google-logo.svg';
      case 'facebook': return '/assets/facebook-logo.svg';
      case '42': return '/assets/intra-logo.svg';
      default: return null;
    }
  }

  private async load(): Promise<void> {
    try {
      this.providers.set(await this.auth.oauthProviders());
    } catch {
      // Password authentication remains fully usable when provider discovery fails.
      this.unavailable.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
