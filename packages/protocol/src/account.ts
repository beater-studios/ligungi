import type { GameSummary } from './games.ts';
import type { PuzzleRatingView } from './puzzles.ts';
import type { UserRef } from './users.ts';

/** A signed-in session listed on the account page; `id` is a public handle, not the session secret. */
export interface SessionView {
  readonly id: string;
  readonly current: boolean;
  readonly createdAt: number;
  readonly seenAt: number;
  readonly userAgent: string | null;
}

/** Two-factor authentication as the account page shows it. */
export interface TwoFactorView {
  readonly enabled: boolean;
  readonly recoveryCodesLeft: number;
}

/** What the authenticator app needs: the secret in base32, also as the otpauth link the QR code carries. */
export interface TwoFactorSetup {
  readonly secret: string;
  readonly uri: string;
}

export interface Me {
  readonly user: UserRef | null;
  readonly playing: readonly GameSummary[];
  /** The signed-in user moderates the site (see the moderation routes). */
  readonly moderator: boolean;
  /** The signed-in user's puzzle rating, for the home page's training card; `null` without an account. */
  readonly puzzleRating: PuzzleRatingView | null;
}
