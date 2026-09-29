import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  return group.get('password')?.value === group.get('confirmPassword')?.value
    ? null
    : { mismatch: true };
}

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  templateUrl: './reset-password.component.html'
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  readonly submitting = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly form = this.fb.nonNullable.group({
    password: ['', [
      Validators.required,
      Validators.minLength(8),
      Validators.maxLength(72),
      Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)
    ]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordsMatch });

  async submit(): Promise<void> {
    if (!this.token) {
      this.toast.error('This password reset link is invalid or incomplete.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const password = this.form.controls.password;
      const confirmation = this.form.controls.confirmPassword;
      if (password.hasError('required')) {
        this.toast.error('Enter a new password.');
      } else if (password.hasError('minlength')) {
        this.toast.error('Password must be at least 8 characters.');
      } else if (password.hasError('maxlength')) {
        this.toast.error('Password must be no more than 72 characters.');
      } else if (password.hasError('pattern')) {
        this.toast.error('Password must contain at least one letter and one number.');
      } else if (confirmation.hasError('required')) {
        this.toast.error('Confirm your new password.');
      } else if (this.form.hasError('mismatch')) {
        this.toast.error('Passwords do not match.');
      } else {
        this.toast.error('Please correct the password fields.');
      }
      return;
    }
    this.submitting.set(true);
    try {
      const value = this.form.getRawValue();
      await this.auth.resetPassword(this.token, value.password, value.confirmPassword);
      this.toast.success('Password changed. Sign in with your new password.');
      await this.router.navigate(['/login']);
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.submitting.set(false);
    }
  }
}
