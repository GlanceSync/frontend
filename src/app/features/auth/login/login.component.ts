import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Set after a successful registration redirect, so the user knows to check their inbox. */
  readonly justRegistered = this.route.snapshot.queryParamMap.get('registered') === '1';

  /** Set by the server's redirect after the link in the verification email is opened. */
  readonly verified = this.route.snapshot.queryParamMap.get('verified');

  /** True when the password was right but the email address is not confirmed yet. */
  readonly needsVerification = signal(false);
  readonly resendEmail = signal('');
  readonly resending = signal(false);
  readonly resendNotice = signal<string | null>(null);

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  async submit(): Promise<void> {
    this.formError.set(null);
    this.needsVerification.set(false);
    this.resendNotice.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    try {
      const { username, password } = this.form.getRawValue();
      await this.auth.login(username, password);
      await this.router.navigate(['/users']);
    } catch (error) {
      this.needsVerification.set(error instanceof HttpErrorResponse && error.status === 403);
      this.formError.set(AuthService.toApiError(error).message);
    } finally {
      this.submitting.set(false);
    }
  }

  async resend(): Promise<void> {
    const email = this.resendEmail().trim();
    if (!email) {
      return;
    }
    this.resending.set(true);
    try {
      await this.auth.resendVerification(email);
      this.resendNotice.set('If that address belongs to an unconfirmed account, a new link is on its way.');
    } catch (error) {
      this.resendNotice.set(AuthService.toApiError(error).message);
    } finally {
      this.resending.set(false);
    }
  }
}
