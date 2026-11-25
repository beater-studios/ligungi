import type { ErrorCode, GameSettings } from '@ligungi/protocol';
import type { Games, Player } from './games.ts';
import type { Lobby } from './lobby.ts';

/** What "play with this call" gives a player: a challenge to wait on, or a game to play or watch. */
export type ActivityTurn = { readonly challengeId: string } | { readonly gameId: string };

/** Instances with nothing going on are forgotten after a day. */
const IDLE_MS = 24 * 60 * 60 * 1000;

/**
 * One table per Discord Activity instance (a voice call running ligungi): the first player to ask opens a challenge,
 * the second accepts it, and anyone after that is sent to the game, to watch it. Once the game ends, the next one to
 * ask opens a new challenge. Kept in memory: an instance lasts only while people are in the call.
 */
export class ActivityTables {
  readonly #tables = new Map<string, { challengeId: string | null; gameId: string | null; at: number }>();
  readonly #lobby: Lobby;
  readonly #games: Games;
  readonly #now: () => number;

  constructor(lobby: Lobby, games: Games, now: () => number) {
    this.#lobby = lobby;
    this.#games = games;
    this.#now = now;
  }

  join(instanceId: string, player: Player, settings: GameSettings): ActivityTurn | ErrorCode {
    this.#sweep();
    const table = this.#tables.get(instanceId) ?? { challengeId: null, gameId: null, at: this.#now() };
    table.at = this.#now();
    this.#tables.set(instanceId, table);

    const game = table.gameId ? this.#games.get(table.gameId) : undefined;
    if (game && game.status === 'started') return { gameId: game.id };

    const challenge = table.challengeId ? this.#lobby.challenge(table.challengeId) : undefined;
    if (challenge && challenge.status === 'open') {
      const mine = challenge.owner.sessionId === player.sessionId || (player.userId !== null && challenge.owner.userId === player.userId);
      if (mine) return { challengeId: challenge.id };
      const accepted = this.#lobby.acceptChallenge(challenge.id, player);
      if (typeof accepted === 'string') return accepted;
      table.challengeId = null;
      table.gameId = accepted.gameId;
      return accepted;
    }

    const created = this.#lobby.createChallenge(player, settings);
    if (typeof created === 'string') return created;
    table.challengeId = created.id;
    table.gameId = null;
    return { challengeId: created.id };
  }

  #sweep(): void {
    const limit = this.#now() - IDLE_MS;
    for (const [id, table] of this.#tables) if (table.at < limit) this.#tables.delete(id);
  }
}
