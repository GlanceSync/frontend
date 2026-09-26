import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { RealtimeService } from './core/realtime.service';
import { CallOverlayComponent } from './pages/call/call-overlay.component';
import { IconComponent } from './shared/icon.component';
import { AvatarComponent } from './shared/avatar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CallOverlayComponent, IconComponent, AvatarComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);

  /** Drives the header. Phase 3 and 4 hang the unread badges off this same shell. */
  readonly currentUser = this.auth.currentUser;

  readonly year = new Date().getFullYear();

  /** Presence indicator in the header; the socket only runs while someone is signed in. */
  readonly connected = this.realtime.connected;

  /** Unread messages across all conversations, shown wherever the user is. */
  readonly unreadTotal = this.realtime.unreadTotal;

  /** Unread notifications behind the bell. */
  readonly notificationUnread = this.realtime.notificationUnread;

  constructor() {
    // The socket's lifetime follows the session: opened on sign-in, closed on sign-out.
    effect(() => {
      if (this.currentUser()) {
        this.realtime.connect();
      } else {
        this.realtime.disconnect();
      }
    });
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
