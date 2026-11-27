import type { AddressInfo } from 'node:net';
import { legalMoves, moveToString, parseFen, type Position } from '@ligungi/engine';
import type { ChallengeView, ClientMessage, GameView, ServerMessage } from '@ligungi/protocol';
import { Game, initialPosition, parseMove } from '@ligungi/engine';
import { afterEach, expect } from 'vitest';
import { WebSocket } from 'ws';
import { createApp, type App } from '../src/app.ts';
import type { ServerConfig } from '../src/config.ts';
import { Moderation, moderatorCommand } from '../src/moderation.ts';
import { Users } from '../src/users.ts';

export interface TestServer {
  readonly app: App;
  readonly base: string;
  close(): Promise<void>;
}

export const startServer = async (overrides: Partial<ServerConfig> = {}): Promise<TestServer> => {
  const app = createApp({
    port: 0,
    host: '127.0.0.1',
    databasePath: ':memory:',
    staticDir: null,
    secureCookies: false,
    cloudflareWebAnalytics: false,
    trustProxy: 'none',
    abortAfterMs: 60_000,
    claimAfterMs: 30_000,
    now: Date.now,
    discord: null,
    arenas: false,
    fetch: () => Promise.reject(new Error('no network in tests')),
    ...overrides,
  });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const { port } = app.server.address() as AddressInfo;
  return { app, base: `http://127.0.0.1:${port}`, close: () => app.close() };
};

/** A browser-like client: keeps the session cookie and an optional WebSocket. */
export class Client {
  readonly base: string;
  cookie = '';
  socket: WebSocket | null = null;
  readonly messages: ServerMessage[] = [];
  #waiters: Array<{ match: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }> = [];
  #cursor = 0;

  constructor(base: string) {
    this.base = base;
  }

  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
    if (method !== 'GET' && body === undefined) body = {};
    const init: RequestInit = {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), cookie: this.cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    };
    const res = await fetch(this.base + path, init).catch(() => fetch(this.base + path, init));
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0]!;
    const text = await res.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {}
    return { status: res.status, data: data as T };
  }

  async connect(): Promise<void> {
    if (!this.cookie) await this.request('GET', '/api/me');
    const socket = new WebSocket(this.base.replace('http', 'ws') + '/ws', { headers: { cookie: this.cookie } });
    this.socket = socket;
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      this.messages.push(message);
      this.#waiters = this.#waiters.filter((w) => {
        if (!w.match(message)) return true;
        this.#cursor = this.messages.length;
        w.resolve(message);
        return false;
      });
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve());
      socket.once('error', reject);
    });
  }

  send(message: ClientMessage): void {
    this.socket!.send(JSON.stringify(message));
  }

  waitFor<T extends ServerMessage>(match: (m: ServerMessage) => m is T, timeout?: number): Promise<T>;
  waitFor(match: (m: ServerMessage) => boolean, timeout?: number): Promise<ServerMessage>;
  waitFor(match: (m: ServerMessage) => boolean, timeout = 3000): Promise<ServerMessage> {
    for (let i = this.#cursor; i < this.messages.length; i++) {
      if (match(this.messages[i]!)) {
        this.#cursor = i + 1;
        return Promise.resolve(this.messages[i]!);
      }
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for message')), timeout);
      this.#waiters.push({
        match,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
      });
    });
  }

  waitGame(id: string, match: (game: GameView) => boolean = () => true, timeout?: number): Promise<GameView> {
    return this.waitFor((m) => m.t === 'game' && m.game.id === id && match(m.game), timeout).then(
      (m) => (m as Extract<ServerMessage, { t: 'game' }>).game,
    );
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }
}

export const positionOf = (game: GameView): Position => {
  const replay = new Game(initialPosition(game.mode, game.firstPlayer, { freeDraft: game.freeDraft }));
  for (const text of game.moves) replay.play(parseMove(text)!);
  return replay.position;
};

/** Plays the first legal board move (not a drop) of the side to move. */
export const firstMove = (game: GameView): string => {
  const moves = legalMoves(positionOf(game));
  return moveToString(moves.find((m) => m.kind === 'move') ?? moves[0]!);
};

export { parseFen };

/** A casual game settings payload: introductory mode, 10+5, the creator plays white. */
export const casual = { mode: 'intro', rated: false, timeControl: { initial: 600, increment: 5 }, color: 'white' };

/**
 * One test server at a time for a test file: `start` boots it (again, after a restart), `client` makes a client of the
 * current one, and after each test every client is disconnected and the server closed.
 */
export const useServer = () => {
  let current: TestServer | undefined;
  const clients: Client[] = [];
  afterEach(async () => {
    for (const client of clients.splice(0)) client.disconnect();
    await current?.close();
    current = undefined;
  });
  return {
    start: async (overrides: Partial<ServerConfig> = {}): Promise<TestServer> => (current = await startServer(overrides)),
    client: (): Client => {
      const c = new Client(current!.base);
      clients.push(c);
      return c;
    },
  };
};

export const signup = async (c: Client, username: string) => {
  const res = await c.request('POST', '/api/signup', { username, password: 'segredo123' });
  expect(res.status).toBe(200);
};

/** Creates a challenge from `a`, accepts it with `b` and subscribes both to the game. */
export const startGame = async (a: Client, b: Client, settings: object = casual) => {
  const created = await a.request<ChallengeView>('POST', '/api/challenges', settings);
  expect(created.status).toBe(200);
  const accepted = await b.request<{ gameId: string }>('POST', `/api/challenges/${created.data.id}/accept`);
  expect(accepted.status).toBe(200);
  const id = accepted.data.gameId;
  for (const c of [a, b]) {
    if (!c.socket) await c.connect();
    c.send({ t: 'sub', topic: `game:${id}` });
  }
  const [viewA] = await Promise.all([a.waitGame(id), b.waitGame(id)]);
  return { id, view: viewA };
};

/** `mover` plays its first legal move and both wait for the game to show it. */
export const play = async (mover: Client, other: Client, view: GameView): Promise<GameView> => {
  const move = firstMove(view);
  mover.send({ t: 'move', game: view.id, move, ply: view.moves.length });
  const next = view.moves.length + 1;
  const [updated] = await Promise.all([
    mover.waitGame(view.id, (g) => g.moves.length === next),
    other.waitGame(view.id, (g) => g.moves.length === next),
  ]);
  return updated;
};

/** Grants the moderator role, as the server command does. */
export const makeModerator = (server: TestServer, name: string) =>
  moderatorCommand(new Moderation(server.app.db, Date.now), new Users(server.app.db, Date.now), ['moderator', 'add', name]);
