/** One chat message, exactly as the API returns it. */
export interface ChatMessage {
  id: number;
  senderId: number;
  recipientId: number;
  body: string;
  createdAt: string;
  readAt?: string;
}
