import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Interest } from '../../interfaces/user/Profile';

@Injectable({ providedIn: 'root' })
export class InterestService {
  private readonly http = inject(HttpClient);

  interests(query?: string): Promise<Interest[]> {
    return firstValueFrom(
      this.http.get<Interest[]>('/api/interests', { params: query ? { q: query } : {} })
    );
  }

  replaceInterests(names: string[]): Promise<Interest[]> {
    return firstValueFrom(this.http.put<Interest[]>('/api/users/me/interests', { names }));
  }
}
