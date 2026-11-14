import { TV_CHANNELS, type TvChannel, type TvChannelView } from '@ligungi/protocol';
import type { Games } from './games.ts';
import type { GameRoom } from './room.ts';

/** How long a channel stays on a game that just ended, so viewers see the result before the next one. */
export const TV_LINGER_MS = 8_000;

const strength = (room: GameRoom) => (room.seats.white.rating ?? 1200) + (room.seats.black.rating ?? 1200);

/**
 * Live games for watching, strongest first, and the channels built on them. A channel keeps its game while it is played
 * and shortly after it ends, as on lichess: a stronger game starting elsewhere does not pull viewers away mid-game.
 */
export class Tv {
  readonly #games: Games;
  readonly #now: () => number;
  readonly #current = new Map<TvChannel, string>();

  constructor(games: Games, now: () => number) {
    this.#games = games;
    this.#now = now;
  }

  /** Games with at least one move, without correspondence, strongest first. */
  live(): GameRoom[] {
    return this.#games
      .live()
      .filter((room) => room.plies > 0)
      .sort((a, b) => strength(b) - strength(a) || b.createdAt - a.createdAt);
  }

  channels(): TvChannelView[] {
    const live = this.live();
    return TV_CHANNELS.map((channel) => {
      const room = this.#keep(channel) ?? live.find((candidate) => channel === 'best' || candidate.mode === channel);
      if (room) this.#current.set(channel, room.id);
      else this.#current.delete(channel);
      return { channel, game: room ? room.summary() : null };
    });
  }

  #keep(channel: TvChannel): GameRoom | undefined {
    const id = this.#current.get(channel);
    const room = id === undefined ? undefined : this.#games.get(id);
    if (!room || room.daysPerMove !== null) return undefined;
    if (room.status === 'started') return room;
    if (room.status === 'ended' && room.endedAt !== null && this.#now() - room.endedAt < TV_LINGER_MS) return room;
    return undefined;
  }
}
