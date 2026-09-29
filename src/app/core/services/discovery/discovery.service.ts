import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DiscoveryCard, DiscoveryPreferences } from '../../interfaces/user/Profile';

@Injectable({ providedIn: 'root' })
export class DiscoveryService {
  private readonly http = inject(HttpClient);

  discover(limit = 50, offset = 0): Promise<DiscoveryCard[]> {
    return firstValueFrom(
      this.http.get<DiscoveryCard[]>('/api/users/discover', {
        params: { limit: String(limit), offset: String(offset) }
      })
    );
  }

  discoveryPreferences(): Promise<DiscoveryPreferences> {
    return firstValueFrom(
      this.http.get<DiscoveryPreferences>('/api/users/me/preferences')
    );
  }

  saveDiscoveryPreferences(preferences: DiscoveryPreferences): Promise<DiscoveryPreferences> {
    return firstValueFrom(
      this.http.put<DiscoveryPreferences>('/api/users/me/preferences', preferences)
    );
  }
}
