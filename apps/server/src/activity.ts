import type { ActivityHallView, ErrorCode, GameSettings } from '@ligungi/protocol';
import type { Games, Player } from './games.ts';
import type { Lobby } from './lobby.ts';

/** Instances with nothing going on are forgotten after a day. */
const IDLE_MS = 24 * 60 * 60 * 1000;
/** Rooms waiting at once in one call; each player keeps at most one. */
const MAX_ROOMS = 20;
/** Games of one call kept in its list; the oldest drop out first. */
const MAX_GAMES = 20;

interface Hall {
  readonly challengeIds: Set<string>;
  readonly gameIds: Set<string>;
  at: number;
}

/**
 * The rooms of each Discord Activity instance (a voice call running ligungi): anyone in the call opens a room, which
 * is a challenge that only people in the same call see, and anyone else there joins it or watches the game it became.
 * Kept in memory: an instance lasts only while people are in the call.
 */
export class ActivityHalls {
  readonly #halls = new Map<string, Hall>();
  readonly #lobby: Lobby;
  readonly #games: Games;
  readonly #now: () => number;

  constructor(lobby: Lobby, games: Games, now: () => number) {
    this.#lobby = lobby;
    this.#games = games;
    this.#now = now;
  }

  view(instanceId: string, viewer: Player): ActivityHallView {
    const hall = this.#halls.get(instanceId);
    if (!hall) return { rooms: [], games: [] };
    this.#prune(hall);
    return {
      rooms: [...hall.challengeIds].flatMap((id) => {
        const challenge = this.#lobby.challenge(id);
        if (!challenge) return [];
        const { challenger, mine } = this.#lobby.challengeView(challenge, viewer);
        return [{ challengeId: id, settings: challenge.settings, challenger, mine }];
      }),
      games: [...hall.gameIds].flatMap((id) => this.#games.get(id)?.summary() ?? []),
    };
  }

  /** Opens a room for the player, closing the one they had open in this call. */
  open(instanceId: string, player: Player, settings: GameSettings): { challengeId: string } | ErrorCode {
    const hall = this.#hall(instanceId);
    for (const id of hall.challengeIds) {
      const challenge = this.#lobby.challenge(id);
      if (challenge && this.#lobby.challengeView(challenge, player).mine) this.#lobby.cancelChallenge(id, player);
    }
    this.#prune(hall);
    if (hall.challengeIds.size >= MAX_ROOMS) return 'tooManyChallenges';
    const created = this.#lobby.createChallenge(player, settings);
    if (typeof created === 'string') return created;
    hall.challengeIds.add(created.id);
    return { challengeId: created.id };
  }

  /** Joins a room of this call, which starts its game. */
  join(instanceId: string, challengeId: string, player: Player): { gameId: string } | ErrorCode {
    const hall = this.#hall(instanceId);
    this.#prune(hall);
    if (!hall.challengeIds.has(challengeId)) return 'challengeUnavailable';
    const accepted = this.#lobby.acceptChallenge(challengeId, player);
    if (typeof accepted === 'string') return accepted;
    hall.challengeIds.delete(challengeId);
    // Someone now playing should not be joined into a second game through the room they had open.
    for (const id of hall.challengeIds) {
      const challenge = this.#lobby.challenge(id);
      if (challenge && this.#lobby.challengeView(challenge, player).mine) this.#lobby.cancelChallenge(id, player);
    }
    this.#prune(hall);
    hall.gameIds.add(accepted.gameId);
    while (hall.gameIds.size > MAX_GAMES) hall.gameIds.delete(hall.gameIds.values().next().value!);
    return accepted;
  }

  #hall(instanceId: string): Hall {
    const limit = this.#now() - IDLE_MS;
    for (const [id, hall] of this.#halls) if (hall.at < limit) this.#halls.delete(id);
    const hall = this.#halls.get(instanceId) ?? { challengeIds: new Set<string>(), gameIds: new Set<string>(), at: 0 };
    hall.at = this.#now();
    this.#halls.set(instanceId, hall);
    return hall;
  }

  /** Drops rooms no longer open and games no longer in progress. */
  #prune(hall: Hall): void {
    for (const id of hall.challengeIds) if (this.#lobby.challenge(id)?.status !== 'open') hall.challengeIds.delete(id);
    for (const id of hall.gameIds) if (this.#games.get(id)?.status !== 'started') hall.gameIds.delete(id);
  }
}
