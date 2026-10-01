import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MapBounds, MapUser } from '../../interfaces/map/MapUser';

@Injectable({ providedIn: 'root' })
export class MapService {
  private readonly http = inject(HttpClient);

  /** The server caps this list; a full page means there are more people than markers shown. */
  static readonly MAX_MARKERS = 300;

  inBounds(bounds: MapBounds): Promise<MapUser[]> {
    return firstValueFrom(this.http.get<MapUser[]>('/api/users/map', {
      params: {
        minLat: String(bounds.minLat),
        minLng: String(bounds.minLng),
        maxLat: String(bounds.maxLat),
        maxLng: String(bounds.maxLng)
      }
    }));
  }
}
