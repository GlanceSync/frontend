import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast/toast.service';
import { IconComponent } from '../icon/icon.component';

/** Renders the ToastService queue. Mounted once, in the app shell. */
@Component({
  selector: 'app-toast',
  imports: [IconComponent],
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (toast of toasts(); track toast.id) {
        <div
          class="toast"
          [class.toast-success]="toast.kind === 'success'"
          [class.toast-error]="toast.kind === 'error'"
          [attr.role]="toast.kind === 'error' ? 'alert' : 'status'"
        >
          <app-icon class="toast-icon" [name]="toast.kind === 'success' ? 'check' : 'alert-circle'" [size]="18" />
          <p class="toast-message">{{ toast.message }}</p>
          <button type="button" class="toast-close" (click)="dismiss(toast.id)" aria-label="Dismiss">
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `
})
export class ToastComponent {
  private readonly toastService = inject(ToastService);

  readonly toasts = this.toastService.toasts;

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
