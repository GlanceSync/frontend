import { Component, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '../../shared/icon.component';
import { avatarHue } from '../../shared/avatar-hue';
import { AuthService } from '../../core/auth.service';
import { PeopleService } from '../../core/people.service';
import { RealtimeService } from '../../core/realtime.service';
import { CallService } from '../../core/call.service';
import { ChatEntry, ChatMessage, Person } from '../../core/models';

@Component({
  selector: 'app-chat',
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  templateUrl: './chat.component.html'
})
export class ChatComponent {
  private readonly fb = inject(FormBuilder);
  private readonly people = inject(PeopleService);
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(AuthService);
  private readonly calls = inject(CallService);

  /** Bound from the route by withComponentInputBinding(). */
  readonly id = input.required<string>();

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  readonly entries = signal<ChatEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly partner = signal<Person | null>(null);

  readonly otherUserId = computed(() => Number(this.id()));
  readonly connected = this.realtime.connected;
  readonly sendError = this.realtime.lastError;

  readonly partnerOnline = computed(() => this.realtime.onlineUserIds().has(this.otherUserId()));

  readonly blocking = signal(false);

  /** Open while the confirmation dialog is showing. */
  readonly confirmingBlock = signal(false);

  /** True when either side has blocked the other: no messages, no calls. */
  readonly blocked = computed(() => {
    const partner = this.partner();
    return Boolean(partner?.blocked || partner?.blockedByThem);
  });

  readonly blockedByMe = computed(() => Boolean(this.partner()?.blocked));

  readonly blockNotice = computed(() => {
    const partner = this.partner();
    if (partner?.blocked) {
      return `You blocked ${partner.username}. Unblock to start talking again.`;
    }
    if (partner?.blockedByThem) {
      return `${partner?.username} has blocked you.`;
    }
    return null;
  });

  /** A call needs the other person online, nothing else running, and no block. */
  readonly canCall = computed(() =>
    this.partnerOnline() && this.calls.state() === 'idle' && !this.blocked()
  );

  /**
   * The timeline with grouping applied: a run of messages from the same person within
   * a few minutes shows one avatar and heading, and the rest are continuation lines.
   */
  /**
   * The timeline with a day separator attached wherever the calendar day changes.
   * Bubbles show who wrote what by which side they sit on, so no author grouping
   * is needed here.
   */
  readonly rows = computed(() => {
    let previousDay = '';

    return this.entries().map(entry => {
      const day = new Date(entry.createdAt).toDateString();
      const dayLabel = day === previousDay ? null : this.dayLabel(entry.createdAt);
      previousDay = day;
      return { entry, dayLabel };
    });
  });

  readonly form = this.fb.nonNullable.group({
    body: ['', [Validators.required, Validators.maxLength(2000)]]
  });

  constructor() {
    // Reloads whenever the route id changes, so navigating between threads works.
    effect(() => {
      const otherUserId = this.otherUserId();
      if (Number.isFinite(otherUserId)) {
        void this.load(otherUserId);
      }
    });

    // Appends live messages that belong to this thread. A subscription rather than an
    // effect, so two messages arriving together are both handled.
    this.realtime.chatMessages.pipe(takeUntilDestroyed()).subscribe(message => {
      if (!this.belongsHere(message)) {
        return;
      }
      this.append({
        kind: 'message',
        id: message.id,
        senderId: message.senderId,
        recipientId: message.recipientId,
        body: message.body,
        createdAt: message.createdAt,
        readAt: message.readAt
      });
      // We are looking at this thread, so anything arriving in it is already read.
      if (message.senderId === this.otherUserId()) {
        this.realtime.markRead(this.otherUserId());
      }
    });

    // Marks our sent messages as read when the other person opens the thread.
    this.realtime.readReceipts.pipe(takeUntilDestroyed()).subscribe(userId => {
      if (userId !== this.otherUserId()) {
        return;
      }
      const now = new Date().toISOString();
      this.entries.update(current =>
        current.map(entry =>
          entry.kind === 'message' && entry.senderId === this.selfId() && !entry.readAt
            ? { ...entry, readAt: now }
            : entry
        )
      );
    });

    // A finished call joins the timeline exactly like a message.
    this.realtime.chatCalls.pipe(takeUntilDestroyed()).subscribe(entry => {
      if (this.belongsHere(entry)) {
        this.append(entry);
      }
    });

    // A reconnect re-sends the read marker, so the badge cannot stick.
    effect(() => {
      if (this.realtime.connected()) {
        this.realtime.markRead(this.otherUserId());
      }
    });
  }

  /**
   * Blocking cuts off contact both ways, so it asks first. Unblocking is harmless
   * and takes effect immediately.
   */
  requestBlockToggle(): void {
    if (this.blockedByMe()) {
      void this.toggleBlock();
    } else {
      this.confirmingBlock.set(true);
    }
  }

  cancelBlock(): void {
    this.confirmingBlock.set(false);
  }

  async toggleBlock(): Promise<void> {
    const partner = this.partner();
    if (!partner || this.blocking()) {
      return;
    }

    this.confirmingBlock.set(false);
    this.blocking.set(true);
    try {
      if (partner.blocked) {
        await this.people.unblock(partner.id);
        this.partner.set({ ...partner, blocked: false });
      } else {
        await this.people.block(partner.id);
        this.partner.set({ ...partner, blocked: true });
      }
    } catch (error) {
      this.error.set(AuthService.toApiError(error).message);
    } finally {
      this.blocking.set(false);
    }
  }

  startCall(mode: 'audio' | 'video'): void {
    const partner = this.partner();
    void this.calls.start(this.otherUserId(), partner?.username ?? 'Someone', mode);
  }

  hue(): number {
    return avatarHue(this.partner()?.username);
  }

  initial(username: string): string {
    return (username || '?').charAt(0).toUpperCase();
  }

  selfId(): number | undefined {
    return this.auth.currentUser()?.id;
  }

  isMine(entry: ChatEntry): boolean {
    return entry.senderId === this.selfId();
  }

  private belongsHere(entry: { senderId: number; recipientId: number }): boolean {
    const other = this.otherUserId();
    return entry.senderId === other || entry.recipientId === other;
  }

  /** Adds an entry unless it is already on screen; ids are unique only within a kind. */
  private append(entry: ChatEntry): void {
    this.entries.update(current =>
      current.some(existing => existing.kind === entry.kind && existing.id === entry.id)
        ? current
        : [...current, entry]
    );
    this.afterRender();
  }

  /** Who a call row should be described from: the caller placed it. */
  isOutgoingCall(entry: ChatEntry): boolean {
    return entry.senderId === this.selfId();
  }

  callIcon(entry: ChatEntry): IconName {
    if (entry.callStatus === 'answered') {
      return entry.callMode === 'video' ? 'video' : 'phone';
    }
    return entry.callStatus === 'declined' ? 'slash' : 'phone-off';
  }

  /**
   * A call is written as a sentence, with the person's name emphasised, so it reads
   * as part of the conversation rather than as a badge.
   * Returns the text before the name, and the text after it.
   */
  callSentence(entry: ChatEntry): { lead: string; name: string; tail: string } {
    const outgoing = this.isOutgoingCall(entry);
    const caller = outgoing ? 'You' : (this.partner()?.username ?? 'They');

    if (entry.callStatus === 'answered') {
      return {
        lead: '',
        name: caller,
        tail: ` started a call that lasted ${this.durationPhrase(entry.callDurationSeconds)}.`
      };
    }

    if (entry.callStatus === 'declined') {
      return outgoing
        ? { lead: '', name: this.partner()?.username ?? 'They', tail: ' declined your call.' }
        : { lead: 'You declined a call from ', name: this.partner()?.username ?? 'them', tail: '.' };
    }

    // Missed reads differently depending on which end you were on.
    return outgoing
      ? { lead: '', name: caller, tail: ' started a call that nobody answered.' }
      : {
          lead: 'You missed a call from ',
          name: this.partner()?.username ?? 'them',
          tail: '.'
        };
  }

  /** "a few seconds", "2 minutes" — the way a call log reads, not a stopwatch. */
  private durationPhrase(seconds?: number): string {
    if (!seconds || seconds < 60) {
      return 'a few seconds';
    }
    const minutes = Math.round(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  /** "Today", "Yesterday", or a full date for a day separator. */
  dayLabel(iso: string): string {
    const at = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (at.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (at.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return at.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  }

  private async load(otherUserId: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.realtime.lastError.set(null);
    try {
      const [history, everyone] = await Promise.all([
        this.people.conversation(otherUserId),
        this.people.list()
      ]);
      this.entries.set(history);
      this.partner.set(everyone.find(person => person.id === otherUserId) ?? null);
      this.realtime.markRead(otherUserId);
      this.afterRender();
    } catch (error) {
      this.error.set(AuthService.toApiError(error).message);
    } finally {
      this.loading.set(false);
    }
  }

  submit(): void {
    const body = this.form.getRawValue().body.trim();
    if (!body) {
      // Nothing typed: say so rather than appearing to do nothing at all.
      this.realtime.lastError.set('Type a message first.');
      return;
    }

    this.realtime.lastError.set(null);
    // The sent message comes back from the server, so nothing is added locally here.
    if (this.realtime.sendChat(this.otherUserId(), body)) {
      this.form.reset({ body: '' });
    } else {
      // The text is deliberately left in the box so nothing is lost.
      this.realtime.lastError.set(
        'Not connected to the server, so that message was not sent. Reconnecting…'
      );
    }
  }

  timeLabel(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  private afterRender(): void {
    // Wait for the new row to exist before scrolling to it.
    setTimeout(() => {
      const element = this.scroller()?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }
}
