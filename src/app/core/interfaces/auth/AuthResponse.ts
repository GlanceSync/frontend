import { AuthUser } from './AuthUser';

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}
