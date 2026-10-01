import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  Account,
  Gender,
  LocationSource,
  Profile,
  SexualPreference
} from '../../interfaces/user/Profile';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);

  myProfile(): Promise<Profile> {
    return firstValueFrom(this.http.get<Profile>('/api/users/me/profile'));
  }

  profile(userId: string): Promise<Profile> {
    return firstValueFrom(this.http.get<Profile>(`/api/users/${userId}/profile`));
  }

  updateProfile(body: {
    gender: Gender;
    sexualPreference: SexualPreference;
    biography: string;
    birthDate: string;
  }): Promise<Profile> {
    return firstValueFrom(this.http.put<Profile>('/api/users/me/profile', body));
  }

  updateLocation(body: {
    source: LocationSource;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    city?: string;
  }): Promise<Profile> {
    return firstValueFrom(this.http.put<Profile>('/api/users/me/location', body));
  }

  updateMapVisibility(showOnMap: boolean): Promise<Profile> {
    return firstValueFrom(this.http.put<Profile>('/api/users/me/map-visibility', { showOnMap }));
  }

  account(): Promise<Account> {
    return firstValueFrom(this.http.get<Account>('/api/users/me/account'));
  }

  updateAccount(body: { firstName: string; lastName: string; email: string }): Promise<Account> {
    return firstValueFrom(this.http.put<Account>('/api/users/me/account', body));
  }
}
