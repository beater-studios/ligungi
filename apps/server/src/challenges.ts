import { parseSettings } from '@ligungi/protocol';
import type { Db } from './db.ts';
import type { Challenge } from './lobby.ts';

interface ChallengeRow {
  id: string;
  settings: string;
  owner_session: string;
  owner_user: string | null;
  owner_name: string;
  destination_user: string | null;
  destination_name: string | null;
  created_at: number;
  status: Challenge['status'];
  game_id: string | null;
}

const fromRow = (row: ChallengeRow): Challenge | undefined => {
  const settings = parseSettings(JSON.parse(row.settings) as unknown);
  if (typeof settings === 'string') return undefined;
  return {
    id: row.id,
    settings,
    owner: { sessionId: row.owner_session, userId: row.owner_user, name: row.owner_name },
    destination: row.destination_user ? { id: row.destination_user, name: row.destination_name ?? '' } : null,
    createdAt: row.created_at,
    status: row.status,
    gameId: row.game_id,
  };
};

/**
 * Correspondence challenges on disk, so a restart does not drop one that waits days for an answer. The other
 * challenges last two hours and need their sender online, so they live in memory only.
 */
export class ChallengeStore {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  all(): Challenge[] {
    const rows = this.#db.prepare('select * from challenges').all() as unknown as ChallengeRow[];
    return rows.flatMap((row) => fromRow(row) ?? []);
  }

  save(challenge: Challenge): void {
    this.#db
      .prepare(
        `insert into challenges (id, settings, owner_session, owner_user, owner_name, destination_user, destination_name,
          created_at, status, game_id)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (id) do update set owner_session = excluded.owner_session, status = excluded.status,
          game_id = excluded.game_id`,
      )
      .run(
        challenge.id,
        JSON.stringify(challenge.settings),
        challenge.owner.sessionId,
        challenge.owner.userId,
        challenge.owner.name,
        challenge.destination?.id ?? null,
        challenge.destination?.name ?? null,
        challenge.createdAt,
        challenge.status,
        challenge.gameId,
      );
  }

  delete(id: string): void {
    this.#db.prepare('delete from challenges where id = ?').run(id);
  }

  /** The challenges a user sent or received, for the data export. */
  forUser(userId: string): Challenge[] {
    const rows = this.#db
      .prepare('select * from challenges where owner_user = ? or destination_user = ? order by created_at')
      .all(userId, userId) as unknown as ChallengeRow[];
    return rows.flatMap((row) => fromRow(row) ?? []);
  }

  deleteForUser(userId: string): void {
    this.#db.prepare('delete from challenges where owner_user = ? or destination_user = ?').run(userId, userId);
  }
}
