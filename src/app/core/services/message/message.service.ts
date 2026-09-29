import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ChatEntry } from '../../interfaces/chat/ChatEntry';

@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly http = inject(HttpClient);

  /** Stored history for one conversation — messages and calls — oldest first. */
  conversation(otherUserId: string): Promise<ChatEntry[]> {
    return firstValueFrom(
      this.http.get<ChatEntry[]>(`/api/messages/${otherUserId}`)
    );
  }
}
