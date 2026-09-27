/** A proposed real-life meeting. */
export interface DateEvent {
  id: string;
  organizerId: string;
  organizerUsername: string;
  inviteeId: string;
  inviteeUsername: string;
  title: string;
  location?: string;
  startsAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
}
