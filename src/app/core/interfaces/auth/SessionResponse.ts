import { AuthUser } from './AuthUser';

/** Answer to "who am I". A null user means nobody is signed in. */
export interface SessionResponse {
  /** Absent, not null, when signed out: the server omits empty fields. */
  user?: AuthUser | null;
}
