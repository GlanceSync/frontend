import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DiscoveryCard, DiscoveryPreferences } from '../../interfaces/user/Profile';

export interface DiscoveryQuery extends DiscoveryPreferences {
  limit?: number;
  offset?: number;
}

export type SortKey = 'age' | 'distance' | 'fame' | 'commonTags';
export type SortOrder = 'asc' | 'desc';

/** The sorts the API accepts, each with the direction people expect first. */
export const SORT_OPTIONS: readonly { value: SortKey; label: string; defaultOrder: SortOrder }[] = [
  { value: 'age', label: 'Age', defaultOrder: 'asc' },
  { value: 'distance', label: 'Distance', defaultOrder: 'asc' },
  { value: 'fame', label: 'Fame rating', defaultOrder: 'desc' },
  { value: 'commonTags', label: 'Common interests', defaultOrder: 'desc' }
];

export function defaultOrder(sort: string | null | undefined): SortOrder {
  return SORT_OPTIONS.find(option => option.value === sort)?.defaultOrder ?? 'asc';
}

@Injectable({ providedIn: 'root' })
export class DiscoveryService {
  private readonly http = inject(HttpClient);

  /** Suggestions: the saved preferences, with any field in `query` overriding them. */
  discover(query: DiscoveryQuery = {}): Promise<DiscoveryCard[]> {
    return firstValueFrom(this.http.get<DiscoveryCard[]>('/api/users/discover', { params: this.params(query) }));
  }

  /** Advanced search: only these criteria, never the saved preferences. */
  search(query: DiscoveryQuery): Promise<DiscoveryCard[]> {
    return firstValueFrom(this.http.get<DiscoveryCard[]>('/api/users/search', { params: this.params(query) }));
  }

  private params(query: DiscoveryQuery): Record<string, string> {
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
    return params;
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
