import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth/auth.service';
import { PeopleService } from '../../core/services/people/people.service';
import { ToastService } from '../../core/services/toast/toast.service';
import { RealtimeService } from '../../core/services/realtime/realtime.service';
import { Person } from '../../core/interfaces/user/Person';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

/**
 * The messenger shell: conversations on the left, the open thread on the right.
 * The thread is a child route, so the list stays mounted while you move between
 * conversations and only the right-hand pane changes.
 */
@Component({
  selector: 'app-messenger',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, IconComponent, AvatarComponent],
  templateUrl: './messenger.component.html'
})
export class MessengerComponent {
  private readonly people = inject(PeopleService);
  private readonly toast = inject(ToastService);
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.auth.currentUser;
  readonly connected = this.realtime.connected;

  private readonly loaded = signal<Person[]>([]);
  readonly loading = signal(true);
  /** The last load failed; the reason went to a toast, the page offers a retry. */
  readonly loadFailed = signal(false);
  readonly search = signal('');

  /**
   * The REST response is a snapshot; the socket is the live truth. Conversations with
   * recent activity float to the top, the way a messenger orders them.
   */
  readonly conversations = computed(() => {
    const online = this.realtime.onlineUserIds();
    const liveLastSeen = this.realtime.lastSeenAt();
    const isLive = this.realtime.connected();
    const unread = this.realtime.unreadByUser();
    const term = this.search().trim().toLowerCase();

    return this.loaded()
      .map(person => ({
        ...person,
        online: isLive ? online.has(person.id) : person.online,
        lastSeenAt: liveLastSeen.get(person.id) ?? person.lastSeenAt,
        unread: unread.get(person.id) ?? 0
      }))
      .filter(person => !term || person.username.toLowerCase().includes(term))
      .sort((a, b) => {
        // Anyone with something new comes first, then by most recent activity.
        if ((b.unread > 0 ? 1 : 0) !== (a.unread > 0 ? 1 : 0)) {
          return (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0);
        }
        const aAt = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
        const bAt = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
        if (aAt !== bAt) {
          return bAt - aAt;
        }
        if (a.online !== b.online) {
          return a.online ? -1 : 1;
        }
        return a.username.localeCompare(b.username);
      });
  });

  readonly onlineCount = computed(() => this.conversations().filter(row => row.online).length);

  /** True while a conversation is open, which on a phone means showing the thread. */
  readonly threadOpen = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => /^\/chat\/\d+/.test(this.router.url)),
      startWith(/^\/chat\/\d+/.test(this.router.url))
    ),
    { initialValue: /^\/chat\/\d+/.test(this.router.url) }
  );

  constructor() {
    void this.load();

    // A new message changes the preview and the ordering, so refresh the list.
    this.realtime.chatMessages.pipe(takeUntilDestroyed()).subscribe(message => {
      const otherId = message.senderId === this.currentUser()?.id
        ? message.recipientId
        : message.senderId;
      this.loaded.update(current =>
        current.map(person =>
          person.id === otherId
            ? {
                ...person,
                lastMessage: message.body,
                lastMessageAt: message.createdAt,
                lastMessageMine: message.senderId === this.currentUser()?.id
              }
            : person
        )
      );
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      this.loaded.set(await this.people.list());
    } catch (error) {
      this.loadFailed.set(true);
      this.toast.apiError(error);
    } finally {
      this.loading.set(false);
    }
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  /** Short, list-friendly time: today shows a clock, otherwise a date. */
  whenLabel(iso?: string): string {
    if (!iso) {
      return '';
    }
    const at = new Date(iso);
    const sameDay = at.toDateString() === new Date().toDateString();
    return sameDay
      ? at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : at.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }

  previewText(person: Person): string {
    if (!person.lastMessage) {
      return person.online ? 'Online' : 'No messages yet';
    }
    return (person.lastMessageMine ? 'You: ' : '') + person.lastMessage;
  }
}
