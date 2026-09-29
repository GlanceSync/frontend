import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Picture } from '../../interfaces/user/Profile';

@Injectable({ providedIn: 'root' })
export class PictureService {
  private readonly http = inject(HttpClient);

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
}
