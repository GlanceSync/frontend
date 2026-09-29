import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Person } from '../../interfaces/user/Person';

@Injectable({ providedIn: 'root' })
export class PeopleService {
  private readonly http = inject(HttpClient);

  /** Everyone but you, with presence as it stood when the request was served. */
  list(): Promise<Person[]> {
    return firstValueFrom(this.http.get<Person[]>('/api/users'));
  }

  report(userId: string, reason?: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`/api/users/${userId}/report`, reason?.trim() ? { reason: reason.trim() } : {})
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
}
