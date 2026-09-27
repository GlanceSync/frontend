export interface AuthUser {
  id: number;
  username: string;
  /** Absent until they upload a profile photo. */
  avatarUrl?: string;
}
