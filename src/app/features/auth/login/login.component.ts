import { Component, inject, signal } from '@angular/core';
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

  /** Set after a successful registration redirect, so the user knows it worked. */
  readonly justRegistered = this.route.snapshot.queryParamMap.get('registered') === '1';

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  async submit(): Promise<void> {
    this.formError.set(null);

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
      this.formError.set(AuthService.toApiError(error).message);
    } finally {
      this.submitting.set(false);
    }
  }
}
