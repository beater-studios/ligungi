import { NOTICES_KEPT, NOTICES_MAX, NOTICE_KINDS, type NoticeKind, type NoticeView } from '@ligungi/protocol';
import type { Db } from './db.ts';

interface NoticeRow {
  id: number;
  kind: string;
  actor_name: string | null;
  subject: string | null;
  ref: string | null;
  created_at: number;
  read_at: number | null;
}

export interface NoticeDetails {
  /** The player who caused it (a follower). Moderation notices have none: moderators are never named. */
  readonly actorId?: string;
  readonly subject?: string;
  readonly ref?: string;
}

/** What the bell tells a player while they were away: new followers and moderation decisions. */
export class Notices {
  readonly #db: Db;
  readonly #now: () => number;

  constructor(db: Db, now: () => number) {
    this.#db = db;
    this.#now = now;
  }

  /**
   * Returns false when nothing was added: a player is told only once that someone follows them, so following and
   * unfollowing over and over cannot be used to pester.
   */
  add(userId: string, kind: NoticeKind, details: NoticeDetails = {}): boolean {
    const actorId = details.actorId ?? null;
    if (kind === 'follow' && this.#db.prepare(`select 1 from notices where user_id = ? and kind = 'follow' and actor_id = ?`).get(userId, actorId)) {
      return false;
    }
    this.#db
      .prepare('insert into notices (user_id, kind, actor_id, subject, ref, created_at) values (?, ?, ?, ?, ?, ?)')
      .run(userId, kind, actorId, details.subject ?? null, details.ref ?? null, this.#now());
    this.#db
      .prepare('delete from notices where user_id = ?1 and id not in (select id from notices where user_id = ?1 order by id desc limit ?2)')
      .run(userId, NOTICES_KEPT);
    return true;
  }

  list(userId: string, limit = NOTICES_MAX): NoticeView[] {
    const rows = this.#db
      .prepare(
        `select notices.id, notices.kind, users.username as actor_name, notices.subject, notices.ref, notices.created_at, notices.read_at
         from notices left join users on users.id = notices.actor_id
         where notices.user_id = ? order by notices.id desc limit ?`,
      )
      .all(userId, limit) as unknown as NoticeRow[];
    return rows.flatMap((row) => {
      const kind = NOTICE_KINDS.find((value) => value === row.kind);
      if (!kind) return [];
      return [{ id: row.id, kind, actor: row.actor_name, subject: row.subject, ref: row.ref, createdAt: row.created_at, read: row.read_at !== null }];
    });
  }

  /** Returns whether anything was unread. */
  markRead(userId: string): boolean {
    return this.#db.prepare('update notices set read_at = ? where user_id = ? and read_at is null').run(this.#now(), userId).changes > 0;
  }
}
