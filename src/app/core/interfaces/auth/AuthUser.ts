export type UserRole = 'USER' | 'ADMIN';

export interface AuthUser {
  id: string;
  username: string;
  avatarUrl?: string | null;
  profileCompleted: boolean;
  role: UserRole;
}
