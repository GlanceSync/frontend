/** One chat message, exactly as the API returns it. */
export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  readAt?: string;
}
