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
