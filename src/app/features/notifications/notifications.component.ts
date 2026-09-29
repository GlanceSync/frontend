import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '../../shared/components/icon/icon.component';
import { NotificationService } from '../../core/services/notification/notification.service';
import { ToastService } from '../../core/services/toast/toast.service';
import { RealtimeService } from '../../core/services/realtime/realtime.service';
import { AppNotification } from '../../core/interfaces/notification/AppNotification';

@Component({
  selector: 'app-notifications',
  imports: [RouterLink, IconComponent],
  templateUrl: './notifications.component.html'
})
export class NotificationsComponent {
  private readonly notifications = inject(NotificationService);
  private readonly toast = inject(ToastService);
  private readonly realtime = inject(RealtimeService);

  readonly items = signal<AppNotification[]>([]);
  readonly loading = signal(true);
  /** The last load failed; the reason went to a toast, the page offers a retry. */
  readonly loadFailed = signal(false);

  constructor() {
    void this.load();

    // Anything arriving while this page is open goes straight to the top.
    this.realtime.notifications.pipe(takeUntilDestroyed()).subscribe(incoming => {
      this.items.update(current =>
        current.some(item => item.id === incoming.id) ? current : [incoming, ...current]
      );
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      this.items.set(await this.notifications.notifications());
      // Opening the page is what marks them read; the badge clears via the socket.
      await this.notifications.markNotificationsRead();
    } catch (error) {
      this.loadFailed.set(true);
      this.toast.apiError(error);
    } finally {
      this.loading.set(false);
    }
  }

  icon(type: string): IconName {
    switch (type) {
      case 'message':
        return 'message';
      case 'call_missed':
        return 'phone-off';
      case 'event_invited':
        return 'calendar';
      case 'event_accepted':
        return 'check';
      case 'event_declined':
        return 'x';
      case 'event_cancelled':
        return 'slash';
      case 'user_blocked':
        return 'block';
      case 'user_unblocked':
        return 'unblock';
      default:
        return 'bell';
    }
  }

  when(iso: string): string {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) {
      return 'just now';
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    return new Date(iso).toLocaleDateString();
  }
}
