import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { AppNotification } from '../../interfaces/notification/AppNotification';
import { CallSignal } from '../../interfaces/call/CallSignal';
import { ChatEntry } from '../../interfaces/chat/ChatEntry';
import { ChatMessage } from '../../interfaces/chat/ChatMessage';

/** Every server push shares this envelope; `type` decides how to read the rest. */
interface RealtimeMessage {
  type: string;
  [key: string]: unknown;
}

interface PresenceInit extends RealtimeMessage {
  onlineUserIds: number[];
}

interface PresenceChanged extends RealtimeMessage {
  userId: number;
  online: boolean;
  lastSeenAt?: string;
}

interface ChatMessageEvent extends RealtimeMessage {
  message: ChatMessage;
}

interface ChatUnreadEvent extends RealtimeMessage {
  byUser?: Record<string, number>;
  total: number;
}

interface ChatReadEvent extends RealtimeMessage {
  byUserId: number;
}

/**
 * Owns the single WebSocket connection. Presence today; chat, notifications and call
 * signalling arrive on this same socket in later phases.
 *
 * This is the one place that touches browser-only APIs, so components stay free of
 * platform checks even though the app is server-rendered.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /** Who is currently online. Authoritative only while `connected()` is true. */
  readonly onlineUserIds = signal<ReadonlySet<number>>(new Set());
  readonly connected = signal(false);

  /** When each user was last seen, learned from disconnect events. */
  readonly lastSeenAt = signal<ReadonlyMap<number, string>>(new Map());

  /** Unread totals, kept current by the server so the header badge is always right. */
  readonly unreadTotal = signal(0);
  readonly unreadByUser = signal<ReadonlyMap<number, number>>(new Map());

  // Events are streams, not state. A signal only ever holds its latest value and
  // effects are flushed asynchronously, so several messages arriving in one tick
  // would collapse into one and the rest would be lost. Subjects deliver every one.

  private readonly chatMessages$ = new Subject<ChatMessage>();
  /** Every received chat message, in order. */
  readonly chatMessages: Observable<ChatMessage> = this.chatMessages$.asObservable();

  private readonly chatCalls$ = new Subject<ChatEntry>();
  /** A finished call, to append to an open conversation. */
  readonly chatCalls: Observable<ChatEntry> = this.chatCalls$.asObservable();

  private readonly readReceipts$ = new Subject<number>();
  /** Emits the id of a user who just read our messages. */
  readonly readReceipts: Observable<number> = this.readReceipts$.asObservable();

  /** The most recent rejection from the server, for the composer to show. */
  readonly lastError = signal<string | null>(null);

  /** Unread notifications, behind the bell in the header. */
  readonly notificationUnread = signal(0);

  private readonly notifications$ = new Subject<AppNotification>();
  /** Every notification as it arrives. */
  readonly notifications: Observable<AppNotification> = this.notifications$.asObservable();

  private readonly callSignals$ = new Subject<CallSignal>();
  /**
   * Call signalling. This must be a stream: a browser emits ICE candidates in rapid
   * bursts, and dropping any of them breaks the connection.
   */
  readonly callSignals: Observable<CallSignal> = this.callSignals$.asObservable();

  private readonly callEnded$ = new Subject<{ callId: string | null; reason: string }>();
  readonly callEnded: Observable<{ callId: string | null; reason: string }> =
    this.callEnded$.asObservable();

  private socket: WebSocket | null = null;
  private wantConnection = false;
  private reconnectDelayMs = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private recoveryBound = false;

  connect(): void {
    if (!this.isBrowser) {
      return;
    }
    this.wantConnection = true;

    // A socket that is open or still opening is fine; anything else is replaced.
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
      return;
    }

    this.listenForRecovery();
    this.open();
  }

  /**
   * A dropped socket is not always noticed: a sleeping tab or a lost network can
   * leave it closed with no further events. Coming back into view, or the browser
   * reporting it is online again, is a good moment to check and retry.
   */
  private listenForRecovery(): void {
    if (this.recoveryBound) {
      return;
    }
    this.recoveryBound = true;

    const retry = () => {
      if (this.wantConnection && (!this.socket || this.socket.readyState > WebSocket.OPEN)) {
        this.reconnectDelayMs = 1000;
        this.clearReconnect();
        this.open();
      }
    };

    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        retry();
      }
    });
  }

  disconnect(): void {
    this.wantConnection = false;
    this.clearReconnect();
    this.socket?.close();
    this.socket = null;
    this.connected.set(false);
    this.onlineUserIds.set(new Set());
    this.unreadTotal.set(0);
    this.unreadByUser.set(new Map());
    this.notificationUnread.set(0);
  }

  /** Starts ringing someone. The server assigns the call id and replies with it. */
  offerCall(targetUserId: number, mode: 'audio' | 'video', payload: unknown): boolean {
    return this.send({ type: 'call:offer', targetUserId, mode, payload });
  }

  answerCall(callId: string, payload: unknown): boolean {
    return this.send({ type: 'call:answer', callId, payload });
  }

  sendIce(callId: string, payload: unknown): boolean {
    return this.send({ type: 'call:ice', callId, payload });
  }

  rejectCall(callId: string): boolean {
    return this.send({ type: 'call:reject', callId });
  }

  hangUp(callId: string): boolean {
    return this.send({ type: 'call:hangup', callId });
  }

  /** Sends a chat message. Returns false when the socket is not open. */
  sendChat(recipientId: number, body: string): boolean {
    return this.send({ type: 'chat:send', recipientId, body });
  }

  /** Marks the conversation with this person as read. */
  markRead(withUserId: number): boolean {
    return this.send({ type: 'chat:read', withUserId });
  }

  private send(payload: unknown): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.socket.send(JSON.stringify(payload));
    return true;
  }

  private open(): void {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    // Same origin, so the session cookie rides the handshake automatically.
    const socket = new WebSocket(`${scheme}://${location.host}/ws`);
    this.socket = socket;

    socket.onopen = () => {
      this.connected.set(true);
      this.reconnectDelayMs = 1000;
    };

    socket.onmessage = event => this.handle(event.data);

    socket.onclose = () => {
      this.connected.set(false);
      this.onlineUserIds.set(new Set());
      this.socket = null;
      if (this.wantConnection) {
        this.scheduleReconnect();
      }
    };

    // An error is always followed by a close, which is where reconnection is handled.
    socket.onerror = () => this.connected.set(false);
  }

  /** Backs off up to 15s so a restarting server is not hammered by every open tab. */
  private scheduleReconnect(): void {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => this.open(), this.reconnectDelayMs);
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 8000);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handle(raw: unknown): void {
    if (typeof raw !== 'string') {
      return;
    }

    let message: RealtimeMessage;
    try {
      message = JSON.parse(raw) as RealtimeMessage;
    } catch {
      return;
    }

    switch (message.type) {
      case 'presence:init': {
        const { onlineUserIds } = message as PresenceInit;
        this.onlineUserIds.set(new Set(onlineUserIds));
        break;
      }
      case 'presence:changed': {
        const { userId, online, lastSeenAt } = message as PresenceChanged;
        this.onlineUserIds.update(current => {
          const next = new Set(current);
          if (online) {
            next.add(userId);
          } else {
            next.delete(userId);
          }
          return next;
        });
        if (!online && lastSeenAt) {
          this.lastSeenAt.update(current => new Map(current).set(userId, lastSeenAt));
        }
        break;
      }
      case 'chat:message': {
        this.chatMessages$.next((message as ChatMessageEvent).message);
        break;
      }
      case 'chat:unread': {
        const event = message as ChatUnreadEvent;
        this.unreadTotal.set(event.total ?? 0);
        const byUser = new Map<number, number>();
        for (const [userId, count] of Object.entries(event.byUser ?? {})) {
          byUser.set(Number(userId), count);
        }
        this.unreadByUser.set(byUser);
        break;
      }
      case 'chat:call': {
        this.chatCalls$.next(message['entry'] as ChatEntry);
        break;
      }
      case 'chat:read': {
        this.readReceipts$.next((message as ChatReadEvent).byUserId);
        break;
      }
      case 'notification:new': {
        this.notifications$.next(message['notification'] as AppNotification);
        break;
      }
      case 'notification:unread': {
        this.notificationUnread.set(Number(message['total'] ?? 0));
        break;
      }
      case 'call:ringing':
      case 'call:incoming':
      case 'call:answered':
      case 'call:ice': {
        this.callSignals$.next(message as unknown as CallSignal);
        break;
      }
      case 'call:ended': {
        this.callEnded$.next({
          callId: (message['callId'] as string) ?? null,
          reason: String(message['reason'] ?? 'ended')
        });
        break;
      }
      case 'chat:error': {
        this.lastError.set(String(message['message'] ?? 'Your message could not be sent.'));
        break;
      }
      default:
        // Unknown types are ignored so a newer server cannot break an older client.
        break;
    }
  }
}
