import type { UserRef } from './users.ts';

/** Why a player reports another. `content` is for what they wrote or drew, such as a study. */
export const REPORT_REASONS = ['cheating', 'name', 'behavior', 'content', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_DETAILS_MAX = 500;

/** Suspension lengths a moderator can pick, in days; `null` is permanent. */
export const SUSPENSION_DAYS: readonly (number | null)[] = [1, 3, 7, 30, null];

export interface ReportView {
  readonly id: string;
  readonly reporter: UserRef;
  readonly target: UserRef;
  readonly gameId: string | null;
  /** The study reported, when the report is about one. */
  readonly studyId: string | null;
  /** The chapter of that study the reporter was on, and the move (its path in the chapter's tree, as `0.1.0`). */
  readonly chapterId: string | null;
  readonly chapterPath: string | null;
  readonly reason: ReportReason;
  readonly details: string;
  readonly createdAt: number;
  readonly status: 'open' | 'closed';
  readonly resolution: string | null;
  readonly closedBy: string | null;
  readonly closedAt: number | null;
}

export type ModAction =
  | 'grant'
  | 'revoke'
  | 'suspend'
  | 'unsuspend'
  | 'rename'
  | 'clearProfile'
  | 'void'
  | 'closeReport'
  | 'hideStudy'
  | 'unhideStudy'
  | 'clearDrawings'
  | 'deleteStudy';

/** One line of the moderation log. Names are kept as they were when the action was taken. */
export interface ModLogEntry {
  readonly id: number;
  readonly moderator: string;
  readonly action: ModAction;
  readonly target: string | null;
  readonly gameId: string | null;
  readonly details: string | null;
  readonly createdAt: number;
}

/** What a moderator sees about a player. */
export interface ModUserView {
  readonly user: UserRef;
  readonly moderator: boolean;
  /** The current suspension, if any; `until` is `null` for a permanent one. */
  readonly suspension: { readonly until: number | null; readonly reason: string } | null;
  readonly openReports: number;
  readonly log: readonly ModLogEntry[];
}
