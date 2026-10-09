export type Gender = 'MALE' | 'FEMALE';
export type SexualPreference = 'HETEROSEXUAL' | 'HOMOSEXUAL' | 'BISEXUAL';
export type LocationSource = 'GPS' | 'MANUAL';

export interface Picture {
  id: string;
  url: string;
  profile: boolean;
  createdAt: string;
}

export interface Profile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  gender?: Gender | null;
  sexualPreference?: SexualPreference | null;
  biography?: string | null;
  age?: number | null;
  city?: string | null;
  fameRating: number;
  online: boolean;
  lastSeenAt?: string | null;
  interests: string[];
  pictures: Picture[];
  birthDate?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracy?: number | null;
  locationSource?: LocationSource | null;
  showOnMap?: boolean | null;
  completed?: boolean | null;
  distanceKm?: number | null;
  likedByMe?: boolean | null;
  likesMe?: boolean | null;
  connected?: boolean | null;
  blocked?: boolean | null;
  blockedByThem?: boolean | null;
}

export interface Account {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  pendingEmail?: string | null;
}

export interface Interest {
  id: string;
  name: string;
  createdBy?: string | null;
  createdAt: string;
}

export interface LikeState {
  likedByMe: boolean;
  likesMe: boolean;
  connected: boolean;
}

export interface ProfileActivity {
  id: string;
  username: string;
  avatarUrl?: string | null;
  at: string;
  connected: boolean;
}

/** Someone in a discovery or search result. Reading it never counts as a profile visit. */
export interface DiscoveryCard {
  id: string;
  username: string;
  firstName: string;
  biography?: string | null;
  avatarUrl?: string | null;
  /** Picture URLs, the profile picture first. */
  pictures: string[];
  gender?: Gender | null;
  age?: number | null;
  city?: string | null;
  distanceKm?: number | null;
  fameRating: number;
  commonTags: number;
  interests: string[];
  online: boolean;
}

export interface DiscoveryPreferences {
  minAge?: number | null;
  maxAge?: number | null;
  minFame?: number | null;
  maxFame?: number | null;
  distance?: number | null;
  city?: string | null;
  tags?: string[] | null;
  minCommonTags?: number | null;
  sort?: string | null;
  order?: string | null;
}
