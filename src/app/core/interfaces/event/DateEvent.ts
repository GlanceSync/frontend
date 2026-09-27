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
