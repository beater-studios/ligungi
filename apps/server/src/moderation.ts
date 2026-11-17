import type { ModAction, ModLogEntry, ReportReason, ReportView } from '@ligungi/protocol';
import type { Db } from './db.ts';
import { randomId } from './ids.ts';
import type { Users } from './users.ts';

/** `suspended_until` of a permanent suspension: the last millisecond of year 9999. */
export const PERMANENT_SUSPENSION = 253402300799999;

/** Who appears as the moderator of actions taken with the server command, outside the site. */
export const SERVER_MODERATOR = 'server';

export interface Suspension {
  /** `null` for a permanent suspension. */
  readonly until: number | null;
  readonly reason: string;
}

interface ReportRow {
  id: string;
  reporter_id: string;
  reporter_name: string;
  target_id: string;
  target_name: string;
  game_id: string | null;
  study_id: string | null;
  reason: ReportReason;
  details: string;
  created_at: number;
  status: 'open' | 'closed';
  resolution: string | null;
  closed_by: string | null;
  closed_at: number | null;
}

interface LogRow {
  id: number;
  moderator_name: string;
  action: ModAction;
  target_name: string | null;
  game_id: string | null;
  details: string | null;
  created_at: number;
}

const toReport = (row: ReportRow): ReportView => ({
  id: row.id,
  reporter: { id: row.reporter_id, name: row.reporter_name },
  target: { id: row.target_id, name: row.target_name },
  gameId: row.game_id,
  studyId: row.study_id,
  reason: row.reason,
  details: row.details,
  createdAt: row.created_at,
  status: row.status,
  resolution: row.resolution,
  closedBy: row.closed_by,
  closedAt: row.closed_at,
});

const toEntry = (row: LogRow): ModLogEntry => ({
  id: row.id,
  moderator: row.moderator_name,
  action: row.action,
  target: row.target_name,
  gameId: row.game_id,
  details: row.details,
  createdAt: row.created_at,
});

const REPORT_SELECT = `select reports.*, reporter.username as reporter_name, target.username as target_name
  from reports join users reporter on reporter.id = reports.reporter_id join users target on target.id = reports.target_id`;

/**
 * Moderation records: who moderates, account suspensions, player reports and the log of every moderator action. The
 * consequences on sessions, games and the lobby are applied by the routes, which know those parts.
 */
export class Moderation {
  readonly #db: Db;
  readonly #now: () => number;

  constructor(db: Db, now: () => number) {
    this.#db = db;
    this.#now = now;
  }

  isModerator(userId: string | null): boolean {
    if (!userId) return false;
    const row = this.#db.prepare('select role from users where id = ?').get(userId) as { role: string } | undefined;
    return row?.role === 'moderator';
  }

  setModerator(userId: string, moderator: boolean): void {
    this.#db.prepare('update users set role = ? where id = ?').run(moderator ? 'moderator' : 'player', userId);
  }

  moderators(): string[] {
    const rows = this.#db.prepare(`select username from users where role = 'moderator' order by username_key`).all() as Array<{ username: string }>;
    return rows.map((row) => row.username);
  }

  /** The suspension in force, or `null` once it has ended (an ended one is simply ignored). */
  suspension(userId: string): Suspension | null {
    const row = this.#db.prepare('select suspended_until, suspension_reason from users where id = ?').get(userId) as
      | { suspended_until: number | null; suspension_reason: string | null }
      | undefined;
    if (!row || row.suspended_until === null || row.suspended_until <= this.#now()) return null;
    return { until: row.suspended_until >= PERMANENT_SUSPENSION ? null : row.suspended_until, reason: row.suspension_reason ?? '' };
  }

  /** `days` null suspends for good. */
  suspend(userId: string, days: number | null, reason: string): Suspension {
    const until = days === null ? PERMANENT_SUSPENSION : this.#now() + days * 86_400_000;
    this.#db.prepare('update users set suspended_until = ?, suspension_reason = ? where id = ?').run(until, reason, userId);
    return { until: days === null ? null : until, reason };
  }

  unsuspend(userId: string): void {
    this.#db.prepare('update users set suspended_until = null, suspension_reason = null where id = ?').run(userId);
  }

  /**
   * A player reports another, or a study by another. One open report per reporter and target at a time, counting a
   * report about a study apart, so a study can be reported while a report about its author is still open.
   */
  report(
    reporterId: string,
    targetId: string,
    reason: ReportReason,
    details: string,
    gameId: string | null,
    studyId: string | null = null,
  ): string | 'alreadyReported' {
    const open = this.#db
      .prepare(`select 1 from reports where reporter_id = ? and target_id = ? and study_id is ? and status = 'open'`)
      .get(reporterId, targetId, studyId);
    if (open) return 'alreadyReported';
    const id = randomId(10);
    this.#db
      .prepare('insert into reports (id, reporter_id, target_id, game_id, study_id, reason, details, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, reporterId, targetId, gameId, studyId, reason, details, this.#now());
    return id;
  }

  reports(status: 'open' | 'closed', limit = 100): ReportView[] {
    const order = status === 'open' ? 'reports.created_at' : 'reports.closed_at desc';
    const rows = this.#db.prepare(`${REPORT_SELECT} where reports.status = ? order by ${order} limit ?`).all(status, limit) as unknown as ReportRow[];
    return rows.map(toReport);
  }

  reportById(id: string): ReportView | undefined {
    const row = this.#db.prepare(`${REPORT_SELECT} where reports.id = ?`).get(id) as ReportRow | undefined;
    return row && toReport(row);
  }

  openReportsAbout(targetId: string): number {
    return (this.#db.prepare(`select count(*) as n from reports where target_id = ? and status = 'open'`).get(targetId) as { n: number }).n;
  }

  closeReport(id: string, moderatorName: string, resolution: string): void {
    this.#db
      .prepare(`update reports set status = 'closed', resolution = ?, closed_by = ?, closed_at = ? where id = ?`)
      .run(resolution, moderatorName, this.#now(), id);
  }

  /** The reports a user made, for the data export. */
  reportsBy(userId: string): ReportView[] {
    const rows = this.#db.prepare(`${REPORT_SELECT} where reports.reporter_id = ? order by reports.created_at`).all(userId) as unknown as ReportRow[];
    return rows.map(toReport);
  }

  log(action: ModAction, moderatorName: string, target: { id: string; name: string } | null, details: string | null, gameId: string | null = null): void {
    this.#db
      .prepare('insert into mod_log (moderator_name, action, target_id, target_name, game_id, details, created_at) values (?, ?, ?, ?, ?, ?, ?)')
      .run(moderatorName, action, target?.id ?? null, target?.name ?? null, gameId, details, this.#now());
  }

  /** The latest log entries, all of them or about one user. */
  entries(targetId: string | null = null, limit = 100): ModLogEntry[] {
    const rows = (
      targetId === null
        ? this.#db.prepare('select * from mod_log order by id desc limit ?').all(limit)
        : this.#db.prepare('select * from mod_log where target_id = ? order by id desc limit ?').all(targetId, limit)
    ) as unknown as LogRow[];
    return rows.map(toEntry);
  }
}

/**
 * The server command that makes or unmakes moderators (`node src/cli.ts moderator add|remove <username>` or `list`).
 * There is no way to become one from the site. Returns what to print and the exit code.
 */
export const moderatorCommand = (moderation: Moderation, users: Users, args: readonly string[]): { readonly code: number; readonly output: string } => {
  const [subject, verb, name] = args;
  const usage = 'usage: moderator add <username> | moderator remove <username> | moderator list';
  if (subject !== 'moderator') return { code: 2, output: usage };
  if (verb === 'list') {
    const names = moderation.moderators();
    return { code: 0, output: names.length ? names.join('\n') : 'no moderators' };
  }
  if ((verb !== 'add' && verb !== 'remove') || !name) return { code: 2, output: usage };
  const user = users.findByName(name);
  if (!user) return { code: 1, output: `no user named ${name}` };
  const add = verb === 'add';
  if (moderation.isModerator(user.id) === add) return { code: 0, output: `${user.name} ${add ? 'already is' : 'is not'} a moderator` };
  moderation.setModerator(user.id, add);
  moderation.log(add ? 'grant' : 'revoke', SERVER_MODERATOR, { id: user.id, name: user.name }, null);
  return { code: 0, output: `${user.name} ${add ? 'is now' : 'is no longer'} a moderator` };
};
