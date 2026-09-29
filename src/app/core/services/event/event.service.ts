import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DateEvent } from '../../interfaces/event/DateEvent';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);

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
