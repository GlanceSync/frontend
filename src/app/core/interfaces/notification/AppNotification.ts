/** A notification row. */
export interface AppNotification {
  id: string;
  type: string;
  actorId?: string;
  actorUsername?: string;
  body: string;
  createdAt: string;
  readAt?: string;
}
