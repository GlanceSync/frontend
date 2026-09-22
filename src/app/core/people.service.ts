import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppNotification, ChatEntry, DateEvent, Person } from './models';

@Injectable({ providedIn: 'root' })
export class PeopleService {
  private readonly http = inject(HttpClient);

  /** Everyone but you, with presence as it stood when the request was served. */
  list(): Promise<Person[]> {
    return firstValueFrom(this.http.get<Person[]>('/api/users', { withCredentials: true }));
  }

  /** Stored history for one conversation — messages and calls — oldest first. */
  conversation(otherUserId: number): Promise<ChatEntry[]> {
    return firstValueFrom(
      this.http.get<ChatEntry[]>(`/api/messages/${otherUserId}`, { withCredentials: true })
    );
  }

  block(otherUserId: number): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`/api/users/${otherUserId}/block`, {}, { withCredentials: true })
    );
  }

  unblock(otherUserId: number): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`/api/users/${otherUserId}/unblock`, {}, { withCredentials: true })
    );
  }

  notifications(): Promise<AppNotification[]> {
    return firstValueFrom(
      this.http.get<AppNotification[]>('/api/notifications', { withCredentials: true })
    );
  }

  markNotificationsRead(): Promise<unknown> {
    return firstValueFrom(
      this.http.post('/api/notifications/read', {}, { withCredentials: true })
    );
  }

  events(): Promise<DateEvent[]> {
    return firstValueFrom(this.http.get<DateEvent[]>('/api/events', { withCredentials: true }));
  }

  proposeEvent(body: {
    inviteeId: number;
    title: string;
    location: string;
    startsAt: string;
  }): Promise<DateEvent> {
    return firstValueFrom(
      this.http.post<DateEvent>('/api/events', body, { withCredentials: true })
    );
  }

  respondToEvent(eventId: number, action: 'accept' | 'decline' | 'cancel'): Promise<DateEvent> {
    return firstValueFrom(
      this.http.post<DateEvent>(`/api/events/${eventId}/${action}`, {}, { withCredentials: true })
    );
  }
}
