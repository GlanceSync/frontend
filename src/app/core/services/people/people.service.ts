import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppNotification } from '../../interfaces/notification/AppNotification';
import { ChatEntry } from '../../interfaces/chat/ChatEntry';
import { DateEvent } from '../../interfaces/event/DateEvent';
import { Person } from '../../interfaces/user/Person';
import {
  Account,
  DiscoveryCard,
  DiscoveryPreferences,
  Gender,
  Interest,
  LikeState,
  LocationSource,
  Picture,
  Profile,
  ProfileActivity,
  SexualPreference
} from '../../interfaces/user/Profile';

@Injectable({ providedIn: 'root' })
export class PeopleService {
  private readonly http = inject(HttpClient);

  /** Everyone but you, with presence as it stood when the request was served. */
  list(): Promise<Person[]> {
    return firstValueFrom(this.http.get<Person[]>('/api/users'));
  }

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
    city?: string;
  }): Promise<Profile> {
    return firstValueFrom(this.http.put<Profile>('/api/users/me/location', body));
  }

  account(): Promise<Account> {
    return firstValueFrom(this.http.get<Account>('/api/users/me/account'));
  }

  updateAccount(body: { firstName: string; lastName: string; email: string }): Promise<Account> {
    return firstValueFrom(this.http.put<Account>('/api/users/me/account', body));
  }

  pictures(userId?: string): Promise<Picture[]> {
    const url = userId ? `/api/users/${userId}/pictures` : '/api/users/me/pictures';
    return firstValueFrom(this.http.get<Picture[]>(url));
  }

  uploadPicture(image: Blob): Promise<Picture[]> {
    return firstValueFrom(this.http.post<Picture[]>('/api/users/me/pictures', image, {
      headers: { 'Content-Type': image.type }
    }));
  }

  makeProfilePicture(pictureId: string): Promise<Picture[]> {
    return firstValueFrom(
      this.http.put<Picture[]>(`/api/users/me/pictures/${pictureId}/profile`, {})
    );
  }

  deletePicture(pictureId: string): Promise<Picture[]> {
    return firstValueFrom(
      this.http.delete<Picture[]>(`/api/users/me/pictures/${pictureId}`)
    );
  }

  interests(query?: string): Promise<Interest[]> {
    return firstValueFrom(
      this.http.get<Interest[]>('/api/interests', { params: query ? { q: query } : {} })
    );
  }

  interest(interestId: string): Promise<Interest> {
    return firstValueFrom(this.http.get<Interest>(`/api/interests/${interestId}`));
  }

  createInterest(name: string): Promise<Interest> {
    return firstValueFrom(this.http.post<Interest>('/api/interests', { name }));
  }

  renameInterest(interestId: string, name: string): Promise<Interest> {
    return firstValueFrom(this.http.put<Interest>(`/api/interests/${interestId}`, { name }));
  }

  deleteInterest(interestId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/interests/${interestId}`));
  }

  myInterests(): Promise<Interest[]> {
    return firstValueFrom(this.http.get<Interest[]>('/api/users/me/interests'));
  }

  userInterests(userId: string): Promise<Interest[]> {
    return firstValueFrom(this.http.get<Interest[]>(`/api/users/${userId}/interests`));
  }

  replaceInterests(names: string[]): Promise<Interest[]> {
    return firstValueFrom(this.http.put<Interest[]>('/api/users/me/interests', { names }));
  }

  addInterest(name: string): Promise<Interest[]> {
    return firstValueFrom(this.http.post<Interest[]>('/api/users/me/interests', { name }));
  }

  removeInterest(interestId: string): Promise<Interest[]> {
    return firstValueFrom(
      this.http.delete<Interest[]>(`/api/users/me/interests/${interestId}`)
    );
  }

  like(userId: string): Promise<LikeState> {
    return firstValueFrom(this.http.post<LikeState>(`/api/users/${userId}/like`, {}));
  }

  unlike(userId: string): Promise<LikeState> {
    return firstValueFrom(this.http.delete<LikeState>(`/api/users/${userId}/like`));
  }

  likedBy(): Promise<ProfileActivity[]> {
    return firstValueFrom(this.http.get<ProfileActivity[]>('/api/users/me/liked-by'));
  }

  profileViews(): Promise<ProfileActivity[]> {
    return firstValueFrom(this.http.get<ProfileActivity[]>('/api/users/me/views'));
  }

  report(userId: string, reason?: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`/api/users/${userId}/report`, reason?.trim() ? { reason: reason.trim() } : {})
    );
  }

  /** Stored history for one conversation — messages and calls — oldest first. */
  conversation(otherUserId: string): Promise<ChatEntry[]> {
    return firstValueFrom(
      this.http.get<ChatEntry[]>(`/api/messages/${otherUserId}`)
    );
  }

  block(otherUserId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`/api/users/${otherUserId}/block`, {})
    );
  }

  unblock(otherUserId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`/api/users/${otherUserId}/unblock`, {})
    );
  }

  notifications(): Promise<AppNotification[]> {
    return firstValueFrom(
      this.http.get<AppNotification[]>('/api/notifications')
    );
  }

  markNotificationsRead(): Promise<unknown> {
    return firstValueFrom(
      this.http.post('/api/notifications/read', {})
    );
  }

  events(): Promise<DateEvent[]> {
    return firstValueFrom(this.http.get<DateEvent[]>('/api/events'));
  }

  proposeEvent(body: {
    inviteeId: string;
    title: string;
    location: string;
    startsAt: string;
  }): Promise<DateEvent> {
    return firstValueFrom(
      this.http.post<DateEvent>('/api/events', body)
    );
  }

  respondToEvent(eventId: string, action: 'accept' | 'decline' | 'cancel'): Promise<DateEvent> {
    return firstValueFrom(
      this.http.post<DateEvent>(`/api/events/${eventId}/${action}`, {})
    );
  }
}
