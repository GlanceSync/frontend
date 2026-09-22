import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '../../shared/icon.component';
import { AuthService } from '../../core/auth.service';
import { PeopleService } from '../../core/people.service';
import { RealtimeService } from '../../core/realtime.service';
import { AppNotification } from '../../core/models';

@Component({
  selector: 'app-notifications',
  imports: [RouterLink, IconComponent],
  templateUrl: './notifications.component.html'
})
export class NotificationsComponent {
  private readonly people = inject(PeopleService);
  private readonly realtime = inject(RealtimeService);

  readonly items = signal<AppNotification[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

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
    this.error.set(null);
    try {
      this.items.set(await this.people.notifications());
      // Opening the page is what marks them read; the badge clears via the socket.
      await this.people.markNotificationsRead();
    } catch (error) {
      this.error.set(AuthService.toApiError(error).message);
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
