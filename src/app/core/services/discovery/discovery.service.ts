import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DiscoveryCard, DiscoveryPreferences } from '../../interfaces/user/Profile';

export interface DiscoveryQuery extends DiscoveryPreferences {
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class DiscoveryService {
  private readonly http = inject(HttpClient);

  discover(query: DiscoveryQuery = {}): Promise<DiscoveryCard[]> {
    const params: Record<string, string> = {};
    const scalarKeys: (keyof DiscoveryQuery)[] = [
      'minAge', 'maxAge', 'minFame', 'maxFame', 'distance', 'city',
      'minCommonTags', 'sort', 'order', 'limit', 'offset'
    ];
    for (const key of scalarKeys) {
      const value = query[key];
      if (value != null && value !== '') params[key] = String(value);
    }
    if (query.tags?.length) params['tags'] = query.tags.join(',');

    return firstValueFrom(
      this.http.get<DiscoveryCard[]>('/api/users/discover', {
        params
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
