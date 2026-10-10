import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ReportedUser } from '../../interfaces/admin/ReportedUser';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  reportedUsers(): Promise<ReportedUser[]> {
    return firstValueFrom(this.http.get<ReportedUser[]>('/api/admin/reports'));
  }

  freeze(userId: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`/api/admin/users/${userId}/freeze`, {}));
  }

  unfreeze(userId: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`/api/admin/users/${userId}/unfreeze`, {}));
  }

  dismissReports(userId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/admin/users/${userId}/reports`));
  }
}
