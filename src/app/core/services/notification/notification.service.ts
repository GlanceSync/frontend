import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppNotification } from '../../interfaces/notification/AppNotification';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);

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
}
