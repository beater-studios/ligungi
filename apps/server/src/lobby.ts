import { opposite, type Color } from '@ligungi/engine';
import {
  sameTimeControl,
  type ErrorCode,
  type ChallengeView,
  type GameSettings,
  type Opponent,
  type SeekView,
  type UserRef,
} from '@ligungi/protocol';
import type { Games, Player } from './games.ts';
import { randomId } from './ids.ts';
import type { GameRoom } from './room.ts';
import type { Users } from './users.ts';

interface Seek {
  readonly id: string;
  readonly settings: GameSettings;
  owner: Player;
  readonly createdAt: number;
}

export interface Challenge {
  readonly id: string;
  readonly settings: GameSettings;
  owner: Player;
  /** Set for a challenge sent from a profile: only this user may accept or decline it. */
  readonly destination: UserRef | null;
  readonly createdAt: number;
  status: 'open' | 'accepted' | 'canceled' | 'declined';
  gameId: string | null;
}

export interface LobbyOptions {
  readonly now: () => number;
  readonly random: () => number;
  readonly onSeeksChange: () => void;
  readonly onChallengeChange: (challenge: Challenge) => void;
  /** Sends both players to the new game. */
  readonly onGameStart: (room: GameRoom) => void;
}

const MAX_SEEKS_PER_PLAYER = 3;
/** Challenges sent from profiles that may wait at once, per sender and per receiver: keeps spam bounded. */
const MAX_DIRECTED_SENT = 3;
const MAX_DIRECTED_RECEIVED = 10;
/** How long a challenge stays open. Expired ones are canceled, then forgotten after another period. */
export const CHALLENGE_TTL = 2 * 60 * 60 * 1000;

const samePerson = (a: Player, b: Player) => a.sessionId === b.sessionId || (a.userId !== null && a.userId === b.userId);

export class Lobby {
  readonly #seeks = new Map<string, Seek>();
  readonly #challenges = new Map<string, Challenge>();
  readonly #games: Games;
  readonly #users: Users;
  readonly #options: LobbyOptions;

  constructor(games: Games, users: Users, options: LobbyOptions) {
    this.#games = games;
    this.#users = users;
    this.#options = options;
  }

  /**
   * Pairs with a compatible open seek, or opens a new one. `canWait` says whether the owner has a live connection:
   * a waiting seek is removed when its owner disconnects, so one created without a connection would never expire.
   */
  createSeek(owner: Player, settings: GameSettings, canWait: boolean): { seekId: string } | { gameId: string } | ErrorCode {
    if (settings.rated && !owner.userId) return 'loginForRated';
    const match = [...this.#seeks.values()].find(
      (seek) => !samePerson(seek.owner, owner) && compatible(seek.settings, settings),
    );
    if (match) {
      this.#seeks.delete(match.id);
      const merged: GameSettings = {
        ...match.settings,
        color: match.settings.color === 'random' && settings.color !== 'random' ? opposite(settings.color) : match.settings.color,
        firstPlayer: match.settings.firstPlayer === 'random' ? settings.firstPlayer : match.settings.firstPlayer,
      };
      const room = this.#start(merged, match.owner, owner);
      this.#options.onSeeksChange();
      return { gameId: room.id };
    }
    if (!canWait) return 'connectionRequired';
    const mine = [...this.#seeks.values()].filter((seek) => samePerson(seek.owner, owner));
    if (mine.length >= MAX_SEEKS_PER_PLAYER) return 'tooManySeeks';
    const seek: Seek = { id: randomId(8), settings, owner, createdAt: this.#options.now() };
    this.#seeks.set(seek.id, seek);
    this.#options.onSeeksChange();
    return { seekId: seek.id };
  }

  acceptSeek(id: string, player: Player): { gameId: string } | ErrorCode {
    const seek = this.#seeks.get(id);
    if (!seek) return 'seekUnavailable';
    if (samePerson(seek.owner, player)) return 'ownSeek';
    if (seek.settings.rated && !player.userId) return 'loginForRated';
    this.#seeks.delete(id);
    const room = this.#start(seek.settings, seek.owner, player);
    this.#options.onSeeksChange();
    return { gameId: room.id };
  }

  cancelSeek(id: string, player: Player): boolean {
    const seek = this.#seeks.get(id);
    if (!seek || !samePerson(seek.owner, player)) return false;
    this.#seeks.delete(id);
    this.#options.onSeeksChange();
    return true;
  }

  /** Moves anonymous seeks and challenges to a new session id after login, signup or logout. */
  rebindSession(from: string, to: string): void {
    for (const item of [...this.#seeks.values(), ...this.#challenges.values()]) {
      if (item.owner.sessionId === from && item.owner.userId === null) item.owner = { ...item.owner, sessionId: to };
    }
  }

  /** Drops everything a deleted account had open in the lobby. */
  removeUser(userId: string): void {
    for (const [id, seek] of this.#seeks) if (seek.owner.userId === userId) this.#seeks.delete(id);
    for (const challenge of this.#challenges.values()) {
      if ((challenge.owner.userId === userId || challenge.destination?.id === userId) && challenge.status === 'open') {
        challenge.status = 'canceled';
        this.#options.onChallengeChange(challenge);
      }
    }
    this.#options.onSeeksChange();
  }

  /** Seeks vanish when their owner leaves, as on lichess. */
  removeSeeksOf(sessionId: string): void {
    let changed = false;
    for (const [id, seek] of this.#seeks) {
      if (seek.owner.sessionId === sessionId) {
        this.#seeks.delete(id);
        changed = true;
      }
    }
    if (changed) this.#options.onSeeksChange();
  }

  seekViews(viewer: Player): SeekView[] {
    return [...this.#seeks.values()]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((seek) => ({
        id: seek.id,
        settings: seek.settings,
        player: this.#opponent(seek.owner, seek.settings),
        mine: samePerson(seek.owner, viewer),
        createdAt: seek.createdAt,
      }));
  }

  createChallenge(owner: Player, settings: GameSettings, destination: UserRef | null = null): Challenge | ErrorCode {
    if (settings.rated && !owner.userId) return 'loginForRated';
    this.sweep();
    if (destination) {
      const open = [...this.#challenges.values()].filter((c) => c.status === 'open' && c.destination);
      if (open.filter((c) => samePerson(c.owner, owner)).length >= MAX_DIRECTED_SENT) return 'tooManyChallenges';
      if (open.filter((c) => c.destination!.id === destination.id).length >= MAX_DIRECTED_RECEIVED) return 'tooManyChallenges';
    }
    const challenge: Challenge = {
      id: randomId(8),
      settings,
      owner,
      destination,
      createdAt: this.#options.now(),
      status: 'open',
      gameId: null,
    };
    this.#challenges.set(challenge.id, challenge);
    return challenge;
  }

  challenge(id: string): Challenge | undefined {
    this.sweep();
    return this.#challenges.get(id);
  }

  acceptChallenge(id: string, player: Player): { gameId: string } | ErrorCode {
    this.sweep();
    const challenge = this.#challenges.get(id);
    if (!challenge || challenge.status !== 'open') return 'challengeUnavailable';
    if (samePerson(challenge.owner, player)) return 'ownChallenge';
    if (challenge.destination && challenge.destination.id !== player.userId) return 'notYourChallenge';
    if (challenge.settings.rated && !player.userId) return 'loginForRated';
    const room = this.#start(challenge.settings, challenge.owner, player);
    challenge.status = 'accepted';
    challenge.gameId = room.id;
    this.#options.onChallengeChange(challenge);
    return { gameId: room.id };
  }

  cancelChallenge(id: string, player: Player): boolean {
    const challenge = this.#challenges.get(id);
    if (!challenge || challenge.status !== 'open' || !samePerson(challenge.owner, player)) return false;
    challenge.status = 'canceled';
    this.#options.onChallengeChange(challenge);
    return true;
  }

  /** The receiver turns down a challenge sent from a profile. */
  declineChallenge(id: string, player: Player): boolean {
    this.sweep();
    const challenge = this.#challenges.get(id);
    if (!challenge || challenge.status !== 'open' || !challenge.destination || challenge.destination.id !== player.userId) return false;
    challenge.status = 'declined';
    this.#options.onChallengeChange(challenge);
    return true;
  }

  /** Open challenges sent to a user, oldest first. */
  incomingFor(userId: string): Challenge[] {
    this.sweep();
    return [...this.#challenges.values()].filter((challenge) => challenge.status === 'open' && challenge.destination?.id === userId);
  }

  /**
   * A challenge sent from a profile needs its sender around to start the game, so it is withdrawn when the sender
   * leaves (like seeks). Links stay: they are meant to be shared and opened later.
   */
  cancelDirectedOf(sessionId: string): void {
    for (const challenge of this.#challenges.values()) {
      if (challenge.status === 'open' && challenge.destination && challenge.owner.sessionId === sessionId) {
        challenge.status = 'canceled';
        this.#options.onChallengeChange(challenge);
      }
    }
  }

  challengeView(challenge: Challenge, viewer: Player): ChallengeView {
    const destination = challenge.destination;
    return {
      id: challenge.id,
      settings: challenge.settings,
      challenger: this.#opponent(challenge.owner, challenge.settings),
      destination: destination
        ? { name: destination.name, user: destination, rating: Math.round(this.#users.rating(destination.id, challenge.settings.mode).rating) }
        : null,
      mine: samePerson(challenge.owner, viewer),
      status: challenge.status,
      gameId: challenge.gameId,
    };
  }

  get seekCount(): number {
    return this.#seeks.size;
  }

  #opponent(player: Player, settings: GameSettings): Opponent {
    const rating = player.userId ? Math.round(this.#users.rating(player.userId, settings.mode).rating) : null;
    return { name: player.name, user: player.userId ? { id: player.userId, name: player.name } : null, rating };
  }

  #start(settings: GameSettings, owner: Player, acceptor: Player): GameRoom {
    const pickColor = (choice: GameSettings['color']): Color =>
      choice === 'random' ? (this.#options.random() < 0.5 ? 'white' : 'black') : choice;
    const ownerColor = pickColor(settings.color);
    const room = this.#games.create({
      mode: settings.mode,
      rated: settings.rated,
      timeControl: settings.timeControl,
      firstPlayer: pickColor(settings.firstPlayer),
      freeDraft: settings.freeDraft,
      players: ownerColor === 'white' ? { white: owner, black: acceptor } : { white: acceptor, black: owner },
    });
    // Players stop seeking once a game starts, so they are never paired into two games at once.
    for (const [id, seek] of this.#seeks) {
      if (samePerson(seek.owner, owner) || samePerson(seek.owner, acceptor)) this.#seeks.delete(id);
    }
    this.#options.onGameStart(room);
    return room;
  }

  /**
   * Cancels open challenges past their TTL (telling whoever watches them, like a cancel by the owner) and forgets
   * challenges a TTL after that, so an old link still says it was canceled for a while. Runs before every read and on
   * a timer, so whether a challenge is still open never depends on unrelated activity.
   */
  sweep(): void {
    const now = this.#options.now();
    const expired: Challenge[] = [];
    for (const [id, challenge] of this.#challenges) {
      const age = now - challenge.createdAt;
      if (age >= 2 * CHALLENGE_TTL) this.#challenges.delete(id);
      else if (age >= CHALLENGE_TTL && challenge.status === 'open') {
        challenge.status = 'canceled';
        expired.push(challenge);
      }
    }
    // Notified after the loop: listeners read the lobby again (the receiver's list), which sweeps once more.
    for (const challenge of expired) this.#options.onChallengeChange(challenge);
  }
}

const compatible = (a: GameSettings, b: GameSettings): boolean =>
  a.mode === b.mode &&
  a.rated === b.rated &&
  a.freeDraft === b.freeDraft &&
  sameTimeControl(a.timeControl, b.timeControl) &&
  (a.color === 'random' || b.color === 'random' || a.color !== b.color) &&
  (a.firstPlayer === 'random' || b.firstPlayer === 'random' || a.firstPlayer === b.firstPlayer);
