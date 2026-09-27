/** A person in the people list, as the API returns them. */
export interface Person {
  id: number;
  username: string;
  avatarUrl?: string;
  online: boolean;
  lastSeenAt?: string;
  /** Preview of the most recent message in this conversation, if there is one. */
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageMine?: boolean;
  /** True when I have blocked them. */
  blocked?: boolean;
  /** True when they have blocked me. */
  blockedByThem?: boolean;
}
