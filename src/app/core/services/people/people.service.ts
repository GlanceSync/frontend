import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppNotification } from '../../interfaces/notification/AppNotification';
import { ChatEntry } from '../../interfaces/chat/ChatEntry';
import { DateEvent } from '../../interfaces/event/DateEvent';
import { Person } from '../../interfaces/user/Person';

@Injectable({ providedIn: 'root' })
export class PeopleService {
  private readonly http = inject(HttpClient);

  /** Everyone but you, with presence as it stood when the request was served. */
  list(): Promise<Person[]> {
    return firstValueFrom(this.http.get<Person[]>('/api/users'));
  }

  /** Stored history for one conversation — messages and calls — oldest first. */
  conversation(otherUserId: string): Promise<ChatEntry[]> {
    return firstValueFrom(
      this.http.get<ChatEntry[]>(`/api/messages/${otherUserId}`)
    );
  }

  block(otherUserId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`/api/users/${otherUserId}/block`, {})
    );
  }

  unblock(otherUserId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`/api/users/${otherUserId}/unblock`, {})
    );
  }

  notifications(): Promise<AppNotification[]> {
    return firstValueFrom(
      this.http.get<AppNotification[]>('/api/notifications')
    );
  }

  markNotificationsRead(): Promise<unknown> {
    return firstValueFrom(
      this.http.post('/api/notifications/read', {})
    );
  }

  events(): Promise<DateEvent[]> {
    return firstValueFrom(this.http.get<DateEvent[]>('/api/events'));
  }

  proposeEvent(body: {
    inviteeId: string;
    title: string;
    location: string;
    startsAt: string;
  }): Promise<DateEvent> {
    return firstValueFrom(
      this.http.post<DateEvent>('/api/events', body)
    );
  }

  respondToEvent(eventId: string, action: 'accept' | 'decline' | 'cancel'): Promise<DateEvent> {
    return firstValueFrom(
      this.http.post<DateEvent>(`/api/events/${eventId}/${action}`, {})
    );
  }
}
