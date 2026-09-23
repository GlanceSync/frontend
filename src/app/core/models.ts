export interface AuthUser {
  id: number;
  username: string;
  /** Absent until they upload a profile photo. */
  avatarUrl?: string;
}

/** A person in the people list, as the API returns them. */
export interface Person {
  id: number;
  username: string;
  avatarUrl?: string;
  online: boolean;
  lastSeenAt?: string;
  /** Preview of the most recent message in this conversation, if there is one. */
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageMine?: boolean;
  /** True when I have blocked them. */
  blocked?: boolean;
  /** True when they have blocked me. */
  blockedByThem?: boolean;
}

/** One chat message, exactly as the API returns it. */
export interface ChatMessage {
  id: number;
  senderId: number;
  recipientId: number;
  body: string;
  createdAt: string;
  readAt?: string;
}

/**
 * One item in a conversation: a message or a call. Ids are only unique within a
 * kind, so anything keying on an entry must combine `kind` and `id`.
 */
export interface ChatEntry {
  kind: 'message' | 'call';
  id: number;
  senderId: number;
  recipientId: number;
  body?: string;
  createdAt: string;
  readAt?: string;
  callStatus?: 'answered' | 'missed' | 'declined';
  callMode?: 'audio' | 'video';
  callDurationSeconds?: number;
}

/** A notification row. */
export interface AppNotification {
  id: number;
  type: string;
  actorId?: number;
  actorUsername?: string;
  body: string;
  createdAt: string;
  readAt?: string;
}

/** A proposed real-life meeting. */
export interface DateEvent {
  id: number;
  organizerId: number;
  organizerUsername: string;
  inviteeId: number;
  inviteeUsername: string;
  title: string;
  location?: string;
  startsAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
}

/** A call signal relayed by the server. `payload` is opaque WebRTC data. */
export interface CallSignal {
  type: string;
  callId: string;
  fromUserId: number;
  fromUsername?: string;
  fromAvatarUrl?: string;
  mode: 'audio' | 'video';
  payload?: Record<string, unknown>;
}

/** Answer to "who am I". A null user means nobody is signed in. */
export interface SessionResponse {
  /** Absent, not null, when signed out: the server omits empty fields. */
  user?: AuthUser | null;
}

/** Shape of every error the API returns. `fields` maps a form control name to its message. */
export interface ApiError {
  message: string;
  fields?: Record<string, string>;
}
