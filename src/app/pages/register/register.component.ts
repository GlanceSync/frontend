import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

/** Mirrors the server's confirmation check so the user gets feedback before submitting. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return !confirm || password === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  /**
   * Field messages returned by the server. The server is the authority on rules like
   * "username taken" or "password too common", which the browser cannot check.
   */
  readonly serverErrors = signal<Record<string, string>>({});

  readonly form = this.fb.nonNullable.group(
    {
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30),
        Validators.pattern(/^[A-Za-z0-9_]+$/)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: passwordsMatch }
  );

  serverError(field: string): string | undefined {
    return this.serverErrors()[field];
  }

  async submit(): Promise<void> {
    this.formError.set(null);
    this.serverErrors.set({});

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    try {
      const { username, password, confirmPassword } = this.form.getRawValue();
      await this.auth.register(username, password, confirmPassword);
      await this.router.navigate(['/login'], { queryParams: { registered: '1' } });
    } catch (error) {
      const apiError = AuthService.toApiError(error);
      this.serverErrors.set(apiError.fields ?? {});
      // Only show the banner when nothing was attached to a specific field.
      this.formError.set(apiError.fields && Object.keys(apiError.fields).length ? null : apiError.message);
    } finally {
      this.submitting.set(false);
    }
  }
}
