import { parseSettings } from '@ligungi/protocol';
import type { Db } from './db.ts';
import type { Seek } from './lobby.ts';

interface SeekRow {
  id: string;
  settings: string;
  owner_session: string;
  owner_user: string;
  owner_name: string;
  created_at: number;
}

const fromRow = (row: SeekRow): Seek | undefined => {
  const settings = parseSettings(JSON.parse(row.settings) as unknown);
  if (typeof settings === 'string') return undefined;
  return {
    id: row.id,
    settings,
    owner: { sessionId: row.owner_session, userId: row.owner_user, name: row.owner_name },
    createdAt: row.created_at,
  };
};

/**
 * Correspondence seeks on disk: they stay in the lobby for days, with or without their owner online. Live seeks vanish
 * when their owner leaves, so they live in memory only.
 */
export class SeekStore {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  all(): Seek[] {
    const rows = this.#db.prepare('select * from seeks').all() as unknown as SeekRow[];
    return rows.flatMap((row) => fromRow(row) ?? []);
  }

  save(seek: Seek): void {
    if (!seek.owner.userId) return;
    this.#db
      .prepare('insert or replace into seeks (id, settings, owner_session, owner_user, owner_name, created_at) values (?, ?, ?, ?, ?, ?)')
      .run(seek.id, JSON.stringify(seek.settings), seek.owner.sessionId, seek.owner.userId, seek.owner.name, seek.createdAt);
  }

  delete(id: string): void {
    this.#db.prepare('delete from seeks where id = ?').run(id);
  }

  /** The seeks a user has open, for the data export. */
  forUser(userId: string): Seek[] {
    const rows = this.#db.prepare('select * from seeks where owner_user = ? order by created_at').all(userId) as unknown as SeekRow[];
    return rows.flatMap((row) => fromRow(row) ?? []);
  }

  deleteForUser(userId: string): void {
    this.#db.prepare('delete from seeks where owner_user = ?').run(userId);
  }
}
