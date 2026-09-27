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
