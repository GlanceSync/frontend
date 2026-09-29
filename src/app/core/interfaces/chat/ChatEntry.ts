/**
 * One item in a conversation: a message or a call. Ids are only unique within a
 * kind, so anything keying on an entry must combine `kind` and `id`.
 */
export interface ChatEntry {
  kind: 'message' | 'call';
  id: string;
  senderId: string;
  recipientId: string;
  body?: string;
  createdAt: string;
  readAt?: string;
  callStatus?: 'answered' | 'missed' | 'declined';
  callMode?: 'audio' | 'video';
  callDurationSeconds?: number;
}
