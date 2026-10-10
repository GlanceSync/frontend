import { Component, computed, inject, signal } from '@angular/core';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { AdminService } from '../../core/services/admin/admin.service';
import { ToastService } from '../../core/services/toast/toast.service';
import { ReportedUser } from '../../core/interfaces/admin/ReportedUser';

@Component({
  selector: 'app-admin',
  imports: [AvatarComponent, IconComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly users = signal<ReportedUser[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  /** The account an action is running for, so its buttons can be disabled meanwhile. */
  readonly busyId = signal<string | null>(null);
  /** Accounts whose individual reports are expanded. */
  readonly expanded = signal<ReadonlySet<string>>(new Set());

  readonly pendingCount = computed(() => this.users().filter(user => user.isActive).length);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      this.users.set(await this.admin.reportedUsers());
    } catch (error) {
      this.loadFailed.set(true);
      this.toast.apiError(error);
    } finally {
      this.loading.set(false);
    }
  }

  freeze(user: ReportedUser): Promise<void> {
    return this.act(user, () => this.admin.freeze(user.id), `${user.username} has been frozen.`);
  }

  unfreeze(user: ReportedUser): Promise<void> {
    return this.act(user, () => this.admin.unfreeze(user.id), `${user.username} has been unfrozen.`);
  }

  dismiss(user: ReportedUser): Promise<void> {
    if (!confirm(`Dismiss all ${user.reportCount} report(s) against ${user.username}?`)) {
      return Promise.resolve();
    }
    return this.act(user, () => this.admin.dismissReports(user.id), `Reports against ${user.username} dismissed.`);
  }

  toggle(userId: string): void {
    this.expanded.update(current => {
      const next = new Set(current);
      if (!next.delete(userId)) {
        next.add(userId);
      }
      return next;
    });
  }

  when(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  /** Runs one moderation action, then reloads so the list order and counts stay true. */
  private async act(user: ReportedUser, action: () => Promise<void>, done: string): Promise<void> {
    this.busyId.set(user.id);
    try {
      await action();
      this.toast.success(done);
      this.users.set(await this.admin.reportedUsers());
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.busyId.set(null);
    }
  }
}
