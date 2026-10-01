/** A marker on the people map. The position is blurred server-side to a few hundred metres. */
export interface MapUser {
  id: string;
  username: string;
  firstName: string;
  avatarUrl?: string | null;
  age?: number | null;
  online: boolean;
  lastSeenAt?: string | null;
  latitude: number;
  longitude: number;
  distanceKm?: number | null;
  commonInterests: string[];
}

export interface MapBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}
