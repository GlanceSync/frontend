import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LikeState, ProfileActivity } from '../../interfaces/user/Profile';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly http = inject(HttpClient);

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
}
