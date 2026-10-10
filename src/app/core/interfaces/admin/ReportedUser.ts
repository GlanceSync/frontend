export interface UserReport {
  reporterId: string;
  reporterUsername: string;
  reason?: string | null;
  createdAt: string;
}

export interface ReportedUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  reportCount: number;
  lastReportedAt: string;
  /** False once an administrator has frozen the account. */
  isActive: boolean;
  reports: UserReport[];
}
