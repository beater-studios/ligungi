import type { Db } from './db.ts';
import { hashRecoveryCode, isRecoveryCode, matchStep, newRecoveryCodes, newSecret, normalizeCode, TOTP_STEP_MS } from './totp.ts';

/** A setup not confirmed within 30 minutes is dropped: its secret is of no use and should not linger. */
const PENDING_STEPS = (30 * 60_000) / TOTP_STEP_MS;

export interface TwoFactorState {
  readonly enabled: boolean;
  readonly enabledAt: number | null;
  readonly recoveryCodesLeft: number;
}

/**
 * Opt-in two-factor authentication. Setup stores a secret that only counts once a first code from the app confirms it;
 * after that, signing in needs a code from the app (each one works once) or one of the single-use recovery codes.
 * `last_step` holds the step of the last code accepted, or, while setup is pending, the step it started at.
 */
export class TwoFactor {
  readonly #db: Db;
  readonly #now: () => number;

  constructor(db: Db, now: () => number) {
    this.#db = db;
    this.#now = now;
  }

  #row(userId: string): { secret: string; enabled_at: number | null; last_step: number } | undefined {
    return this.#db.prepare('select secret, enabled_at, last_step from two_factor where user_id = ?').get(userId) as
      | { secret: string; enabled_at: number | null; last_step: number }
      | undefined;
  }

  state(userId: string): TwoFactorState {
    const row = this.#row(userId);
    const enabled = row?.enabled_at != null;
    const left = enabled
      ? (this.#db.prepare('select count(*) as n from recovery_codes where user_id = ?').get(userId) as { n: number }).n
      : 0;
    return { enabled, enabledAt: row?.enabled_at ?? null, recoveryCodesLeft: left };
  }

  isEnabled(userId: string): boolean {
    return this.#row(userId)?.enabled_at != null;
  }

  #step(): number {
    return Math.floor(this.#now() / TOTP_STEP_MS);
  }

  /** A new secret for the app, replacing one never confirmed. `null` when two-factor is already on. */
  begin(userId: string): string | null {
    if (this.isEnabled(userId)) return null;
    const secret = newSecret();
    this.#db
      .prepare(
        'insert into two_factor (user_id, secret, enabled_at, last_step) values (?, ?, null, ?) on conflict (user_id) do update set secret = excluded.secret, last_step = excluded.last_step',
      )
      .run(userId, secret, this.#step());
    return secret;
  }

  /** Drops a setup the user gave up on. Two-factor already on is left alone. */
  cancel(userId: string): void {
    this.#db.prepare('delete from two_factor where user_id = ? and enabled_at is null').run(userId);
  }

  /** Drops setups left unconfirmed for over 30 minutes. Returns how many were removed. */
  sweep(): number {
    const result = this.#db.prepare('delete from two_factor where enabled_at is null and last_step < ?').run(this.#step() - PENDING_STEPS);
    return Number(result.changes);
  }

  /** Turns two-factor on once the app shows the right code, and returns the first recovery codes. */
  confirm(userId: string, input: string): string[] | 'notSetUp' | 'wrongCode' {
    const row = this.#row(userId);
    if (!row || row.enabled_at !== null) return 'notSetUp';
    if (row.last_step < this.#step() - PENDING_STEPS) {
      this.cancel(userId);
      return 'notSetUp';
    }
    const step = matchStep(row.secret, normalizeCode(input), this.#now());
    if (step === null) return 'wrongCode';
    return this.#transaction(() => {
      this.#db.prepare('update two_factor set enabled_at = ?, last_step = ? where user_id = ?').run(this.#now(), step, userId);
      return this.#replaceRecoveryCodes(userId);
    });
  }

  /**
   * Checks a code for an account with two-factor on: one from the app that was not used yet (its time step is kept, so
   * a code seen by someone else cannot be replayed), or a recovery code, which is used up.
   */
  verify(userId: string, input: string): boolean {
    const row = this.#row(userId);
    if (!row || row.enabled_at === null) return false;
    const code = normalizeCode(input);
    if (isRecoveryCode(code)) {
      const result = this.#db.prepare('delete from recovery_codes where user_id = ? and code_hash = ?').run(userId, hashRecoveryCode(code));
      return Number(result.changes) > 0;
    }
    const step = matchStep(row.secret, code, this.#now());
    if (step === null || step <= row.last_step) return false;
    this.#db.prepare('update two_factor set last_step = ? where user_id = ?').run(step, userId);
    return true;
  }

  /** New recovery codes; the old ones stop working. */
  regenerate(userId: string): string[] {
    return this.#transaction(() => this.#replaceRecoveryCodes(userId));
  }

  disable(userId: string): void {
    this.#transaction(() => {
      this.#db.prepare('delete from recovery_codes where user_id = ?').run(userId);
      this.#db.prepare('delete from two_factor where user_id = ?').run(userId);
    });
  }

  #replaceRecoveryCodes(userId: string): string[] {
    const codes = newRecoveryCodes();
    this.#db.prepare('delete from recovery_codes where user_id = ?').run(userId);
    const insert = this.#db.prepare('insert into recovery_codes (user_id, code_hash) values (?, ?)');
    for (const code of codes) insert.run(userId, hashRecoveryCode(normalizeCode(code)));
    return codes;
  }

  #transaction<T>(work: () => T): T {
    this.#db.exec('begin');
    try {
      const result = work();
      this.#db.exec('commit');
      return result;
    } catch (error) {
      this.#db.exec('rollback');
      throw error;
    }
  }
}
