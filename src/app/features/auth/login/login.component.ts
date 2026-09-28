import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ToastService } from '../../../core/services/toast/toast.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  /** True when the password was right but the email address is not confirmed yet. */
  readonly needsVerification = signal(false);
  readonly resendEmail = signal('');
  readonly resending = signal(false);

  readonly submitting = signal(false);
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  constructor() {
    const params = this.route.snapshot.queryParamMap;

    // Set after a successful registration redirect, so the user knows to check their inbox.
    if (params.get('registered') === '1') {
      this.toast.success('Account created. Check your inbox and open the link we sent to confirm your email.');
    }

    // Set by the server's redirect after the link in the verification email is opened.
    const verified = params.get('verified');
    if (verified === 'success') {
      this.toast.success('Email confirmed. You can sign in now.');
    } else if (verified === 'invalid') {
      this.toast.error('That confirmation link is invalid or has expired. Sign in to request a new one.');
    }
  }

  async submit(): Promise<void> {
    this.needsVerification.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    try {
      const { username, password } = this.form.getRawValue();
      const user = await this.auth.login(username, password);
      this.toast.success(`Welcome back, ${user.username}!`);
      await this.router.navigate(['/users']);
    } catch (error) {
      this.needsVerification.set(error instanceof HttpErrorResponse && error.status === 403);
      this.toast.apiError(error);
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
      this.toast.success('If that address belongs to an unconfirmed account, a new link is on its way.');
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.resending.set(false);
    }
  }
}
