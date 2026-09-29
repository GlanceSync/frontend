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
  locationSource?: LocationSource | null;
  completed?: boolean | null;
  distanceKm?: number | null;
  likedByMe?: boolean | null;
  likesMe?: boolean | null;
  connected?: boolean | null;
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
