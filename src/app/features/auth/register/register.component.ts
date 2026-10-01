import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ToastService } from '../../../core/services/toast/toast.service';
import { OAuthButtonsComponent } from '../oauth-buttons/oauth-buttons.component';

/** Mirrors the server's confirmation check so the user gets feedback before submitting. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return !confirm || password === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, IconComponent, OAuthButtonsComponent],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly submitting = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30),
        Validators.pattern(/^[A-Za-z0-9_]+$/)]],
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: passwordsMatch }
  );

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    try {
      await this.auth.register(this.form.getRawValue());
      await this.router.navigate(['/login'], { queryParams: { registered: '1' } });
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.submitting.set(false);
    }
  }
}
