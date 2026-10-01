import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface CitySearchResult {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

/**
 * Place names from OpenStreetMap's Nominatim. Its usage policy allows one request a
 * second, and this service is the only caller, so the limit holds app-wide.
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly http = inject(HttpClient);
  private readonly searchCache = new Map<string, CitySearchResult[]>();
  private lastRequestAt = 0;

  async searchCities(query: string): Promise<CitySearchResult[]> {
    const cacheKey = query.toLocaleLowerCase();
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    await this.respectRateLimit();
    const results = await firstValueFrom(this.http.get<CitySearchResult[]>(
      'https://nominatim.openstreetmap.org/search',
      {
        params: {
          format: 'jsonv2',
          q: query,
          limit: '5',
          addressdetails: '1',
          layer: 'address',
          featureType: 'settlement'
        }
      }
    ));
    this.searchCache.set(cacheKey, results);
    return results;
  }

  /** The town or city at a point, or null when there is no name for it. */
  async placeName(latitude: number, longitude: number): Promise<string | null> {
    await this.respectRateLimit();
    const result = await firstValueFrom(this.http.get<Pick<CitySearchResult, 'display_name' | 'address'>>(
      'https://nominatim.openstreetmap.org/reverse',
      {
        params: {
          format: 'jsonv2',
          lat: String(latitude),
          lon: String(longitude),
          zoom: '10',
          addressdetails: '1'
        }
      }
    ));
    const address = result.address;
    return address?.city ?? address?.town ?? address?.village
      ?? address?.municipality ?? address?.county ?? address?.state ?? null;
  }

  static cityName(result: CitySearchResult): string {
    const address = result.address;
    return address?.city ?? address?.town ?? address?.village
      ?? address?.municipality ?? result.name ?? result.display_name.split(',')[0];
  }

  private async respectRateLimit(): Promise<void> {
    const wait = Math.max(0, 1000 - (Date.now() - this.lastRequestAt));
    this.lastRequestAt = Date.now() + wait;
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  }
}
