import { ACTION_SIZE, LEVELS, boardFromFen, buildSan, canonicalMove, describeMove, generateRecords, installWorkerHost, makeFakeMlhEvaluator } from '@komugi-ai/engine';
import type { KomugiWorkerLike, ProbeSession, WorkerInitEnv, WorkerInitRequest, WorkerReplyOk, WorkerRequest, WorkerStats } from '@komugi-ai/engine';
import { applyMove, fromRulebook, initialPosition, legalMoves, moveToString, type Move, type Position } from '@ligungi/engine';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KOMUGI_RULES, komugiPlays, komugiReplyToLigungi, komugiSearchInput, type KomugiPosition } from '../../src/komugi/bridge.ts';
import { KomugiPlayer, findKomugiAssets, type KomugiAssets, type KomugiTurn, type KomugiTurnInput } from '../../src/komugi/client.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isInit = (message: unknown): message is WorkerInitRequest => isRecord(message) && message.type === 'init';
const isSearch = (message: unknown): message is WorkerRequest => isRecord(message) && typeof message.fen === 'string';

/** A worker as KomugiClient sees it, driven by the test. */
class FakeWorker implements KomugiWorkerLike {
  readonly sent: unknown[] = [];
  terminated = false;
  readonly #listeners: { readonly type: string; readonly listener: (event: { data: unknown }) => void }[] = [];

  postMessage(message: unknown): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  addEventListener(type: string, listener: (event: { data: unknown }) => void): void {
    this.#listeners.push({ type, listener });
  }

  emit(type: 'message' | 'error', data: unknown): void {
    for (const entry of this.#listeners) if (entry.type === type) entry.listener({ data });
  }

  init(): WorkerInitRequest {
    const init = this.sent.find(isInit);
    if (!init) throw new Error('no init was posted');
    return init;
  }

  searches(): WorkerRequest[] {
    return this.sent.filter(isSearch);
  }

  lastSearch(): WorkerRequest {
    const search = this.searches().at(-1);
    if (!search) throw new Error('no search was posted');
    return search;
  }

  ready(): void {
    const probeRecord = { backend: 'wasm', threads: 1, msPerPosition: {}, chosenBatch: 1, probedAt: 0 };
    this.emit('message', { id: this.init().id, backend: 'wasm', threads: 1, batch: 1, probeRecord });
  }
}

const MODEL = new TextEncoder().encode('a stand-in for the onnx model');
const SHA256 = createHash('sha256').update(MODEL).digest('hex');
const CARD_URL = 'http://localhost/komugi/komugi-test-s1-0123abcd.card.json';
const CARD = {
  id: 'komugi-test-s1-0123abcd',
  campaign: 'test',
  iteration: 1,
  step: 1,
  compatibilityKey: { planeMapVersion: 3, actionEncodingVersion: 2, rulesProfile: 'ligungi', architectureTag: 'b1c8' },
  modesTrained: ['advanced'],
  assets: { pt: { path: 'model.pt', sha256: '0'.repeat(64) }, onnx: { path: 'model.onnx', sha256: SHA256, bytes: MODEL.length } },
  sourceCheckpoint: { name: 'checkpoint.pt', sha256: '0'.repeat(64) },
  exportOpset: 17,
  exportParity: { n: 1, maxAbsDelta: 0, atol: 0, rtol: 0 },
  evalPointers: [],
  license: 'MIT, Copyright (c) 2026 chessai',
  createdAt: '2026-11-22T00:00:00Z',
};
const ASSETS: KomugiAssets = {
  ortAssets: { wasm: { mjs: 'http://localhost/komugi/ort-1.31.1/ort-wasm-simd-threaded.mjs', wasm: 'http://localhost/komugi/ort-1.31.1/ort-wasm-simd-threaded.wasm' } },
  cardUrl: CARD_URL,
};

const STATS: WorkerStats = {
  playouts: 4,
  evaluations: 4,
  nodes: 5,
  rootWdl: [0.4, 0.2, 0.4],
  q: 0,
  tactical: null,
  ms: 12,
  model_sha256: SHA256,
  sims: 4,
  draftmin: 10,
  discovery: 'on',
  mlh: '0.05/0.8/0.9/32',
  deadlineHit: false,
};

/** The release as the server serves it; `model` replaces the model's bytes. */
const serve = (model: Uint8Array = MODEL) => {
  const requests: string[] = [];
  const fetch = async (url: string): Promise<Response> => {
    requests.push(url);
    if (url === CARD_URL) return Response.json(CARD);
    if (url === 'http://localhost/komugi/model.onnx') return new Response(model.slice());
    return new Response('not found', { status: 404 });
  };
  return { fetch, requests };
};

const setup = (options: { readonly model?: Uint8Array; readonly createWorker?: () => KomugiWorkerLike } = {}) => {
  const workers: FakeWorker[] = [];
  const server = serve(options.model);
  const player = new KomugiPlayer({
    assets: ASSETS,
    createWorker:
      options.createWorker ??
      (() => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      }),
    load: { fetch: server.fetch, cache: false },
  });
  /** The latest worker, once it has been sent its init. */
  const worker = async (count = workers.length || 1): Promise<FakeWorker> => {
    await vi.waitFor(() => expect(workers.length).toBeGreaterThanOrEqual(count));
    const last = workers.at(-1);
    if (!last) throw new Error('no worker was started');
    return last;
  };
  /** The latest worker's latest search, once posted. */
  const searched = async (count = 1): Promise<WorkerRequest> => {
    const last = await worker();
    await vi.waitFor(() => expect(last.searches().length).toBeGreaterThanOrEqual(count));
    return last.lastSearch();
  };
  return { player, workers, worker, searched, server };
};

const START = initialPosition('advanced', 'white');
const marshal = (column: number, row: number): Move => ({ kind: 'drop', role: 'marshal', to: fromRulebook(column, row) });
const soldier = (column: number, row: number): Move => ({ kind: 'drop', role: 'soldier', to: fromRulebook(column, row) });

const game = (moves: readonly Move[], level: KomugiTurnInput['level'] = 'focused'): KomugiTurnInput & { position: KomugiPosition } => {
  const position = moves.reduce<Position>(applyMove, START);
  if (!komugiPlays(position)) throw new Error('not a Komugi position');
  return { position, start: START, moves, level };
};

/** Komugi's reply naming the move with this canonical text in the searched position. */
const replyFor = (search: WorkerRequest, canonical: string): WorkerReplyOk => {
  const board = boardFromFen(search.fen);
  const record = generateRecords(board, KOMUGI_RULES).find((r) => canonicalMove(r.struct) === canonical);
  if (!record) throw new Error(`Komugi has no ${canonical} here`);
  return { id: search.id, san: buildSan(board, record.struct), action: record.id, stats: STATS, stamp: 'present', descriptor: describeMove(board, record.id) };
};

const answer = (w: FakeWorker, search: WorkerRequest, canonical: string): void => w.emit('message', replyFor(search, canonical));

afterEach(() => {
  vi.useRealTimers();
});

describe('komugi player', () => {
  it('loads the model, starts the worker with it, then searches what komugiSearchInput gives at the level', async () => {
    const { player, worker, searched } = setup();
    const input = game([marshal(5, 9), marshal(5, 1), soldier(5, 7)], 'sharp');
    void player.turn(input);
    const w = await worker();
    expect(w.init()).toMatchObject({ type: 'init', modelUrl: expect.stringMatching(/^blob:/), modelSha256: SHA256, ortAssets: ASSETS.ortAssets });
    w.ready();
    const expected = komugiSearchInput(input.position, input.moves);
    expect(expected.history).toHaveLength(3);
    expect(await searched()).toEqual({
      id: expect.any(String),
      fen: expected.fen,
      history: expected.history,
      rules: 'ligungi',
      planeMapVersion: 3,
      sims: LEVELS.sharp.playouts,
      maxMs: LEVELS.sharp.capMs,
      batch: LEVELS.sharp.batch.wasm1t,
    });
  });

  it('sends no history for a game from a set-up position', async () => {
    const { player, worker, searched } = setup();
    const input = game([marshal(5, 9), marshal(5, 1)]);
    void player.turn({ ...input, start: input.position, moves: [] });
    (await worker()).ready();
    expect(await searched()).toMatchObject({ fen: komugiSearchInput(input.position).fen, history: null });
  });

  it('maps a reply to ligungi moves', async () => {
    const { player, worker, searched } = setup();
    const input = game([marshal(5, 9), marshal(5, 1)]);
    const turn = player.turn(input);
    const w = await worker();
    w.ready();
    const reply = replyFor(await searched(), 'D:soldier@7-5');
    w.emit('message', reply);
    const result = await turn;
    expect(result).toEqual({ ok: true, moves: [soldier(5, 7)], stats: STATS });
    expect(result.ok && result.moves).toEqual(komugiReplyToLigungi(input.position, reply).moves);
  });

  it('plays the done owed after a 終 placement at its next turn, without searching', async () => {
    const { player, worker, searched } = setup();
    const first = player.turn(game([]));
    const w = await worker();
    w.ready();
    answer(w, await searched(), 'D:marshal@9-5+done');
    expect(await first).toEqual({ ok: true, moves: [marshal(5, 9)], stats: STATS });

    // Black (the player) places; White's done is due now.
    const next = await player.turn(game([marshal(5, 9), marshal(5, 1)]));
    expect(next).toEqual({ ok: true, moves: [{ kind: 'done' }], stats: null });
    expect(w.searches()).toHaveLength(1);

    // Owed once only: asked again for that position, Komugi searches it.
    void player.turn(game([marshal(5, 9), marshal(5, 1)]));
    await searched(2);
  });

  it('forgets the owed done when the game no longer goes through that placement', async () => {
    const { player, worker, searched } = setup();
    const first = player.turn(game([]));
    const w = await worker();
    w.ready();
    answer(w, await searched(), 'D:marshal@9-5+done');
    await first;

    // A different White first move (the game was taken back and replayed): Komugi searches.
    const other = game([marshal(4, 9), marshal(5, 1)]);
    expect(legalMoves(other.position).some((move) => move.kind === 'done')).toBe(true);
    void player.turn(other);
    await searched(2);
  });

  it('shares the search under way when asked again, and answers a finished one again without searching', async () => {
    const { player, worker, searched } = setup();
    const input = game([marshal(5, 9), marshal(5, 1)]);
    const a = player.turn(input);
    const b = player.turn(input);
    const w = await worker();
    w.ready();
    answer(w, await searched(), 'D:soldier@7-5');
    // Asked again while the reply is on its way, and once it has been answered.
    const results: (KomugiTurn | 'searching')[] = await Promise.all([a, b, player.turn(input)]);
    const searching = new Promise<'searching'>((resolve) => setTimeout(() => resolve('searching'), 100));
    results.push(await Promise.race([player.turn(input), searching]));
    for (const result of results) expect(result).toEqual({ ok: true, moves: [soldier(5, 7)], stats: STATS });
    expect(w.searches()).toHaveLength(1);
  });

  it('ignores a reply with a stale id', async () => {
    const { player, worker, searched } = setup();
    let answered = false;
    const turn = player.turn(game([marshal(5, 9), marshal(5, 1)])).then((result) => {
      answered = true;
      return result;
    });
    const w = await worker();
    w.ready();
    const search = await searched();
    w.emit('message', { ...replyFor(search, 'D:soldier@7-5'), id: `${search.id}x` });
    w.emit('message', { id: 's0', err: 'an old search' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(answered).toBe(false);
    answer(w, search, 'D:soldier@7-5');
    expect(await turn).toMatchObject({ ok: true, moves: [soldier(5, 7)] });
  });

  it('reports a timeout with no move (no other engine plays it), and starts a new worker for the next search', async () => {
    vi.useFakeTimers();
    const { player, workers, worker, searched } = setup();
    const turn = player.turn(game([marshal(5, 9), marshal(5, 1)], 'casual'));
    let settled = false;
    void turn.then(() => (settled = true));
    (await worker()).ready();
    await searched();
    await vi.advanceTimersByTimeAsync(LEVELS.casual.capMs + 4_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await turn).toMatchObject({ ok: false, failure: { code: 'timeout' } });
    expect(workers[0]?.terminated).toBe(true);
    vi.useRealTimers();

    void player.turn(game([marshal(5, 9), marshal(5, 1), soldier(5, 7)]));
    expect((await worker(2)).init().type).toBe('init');
  });

  it('reports an engine error with no move', async () => {
    const { player, worker, searched } = setup();
    const turn = player.turn(game([marshal(5, 9), marshal(5, 1)]));
    const w = await worker();
    w.ready();
    w.emit('message', { id: (await searched()).id, err: 'root position is terminal' });
    expect(await turn).toEqual({ ok: false, failure: { code: 'backend-unavailable', message: 'root position is terminal' } });
  });

  it('reports a reply that does not translate (KomugiBridgeError) with no move', async () => {
    const { player, worker, searched } = setup();
    const turn = player.turn(game([marshal(5, 9), marshal(5, 1)]));
    const w = await worker();
    w.ready();
    w.emit('message', { id: (await searched()).id, san: '新帥(9-9-9)', action: 0, stats: STATS });
    expect(await turn).toMatchObject({ ok: false, failure: { code: 'bridge-error' } });
  });

  it('keeps a failure to start: later turns fail at once, with no new worker', async () => {
    const { player, workers, worker } = setup();
    const first = player.turn(game([marshal(5, 9), marshal(5, 1)]));
    const w = await worker();
    w.emit('message', { id: w.init().id, err: 'sha256 differs', code: 'sha-mismatch' });
    expect(await first).toEqual({ ok: false, failure: { code: 'sha-mismatch', message: 'sha256 differs' } });
    expect(w.terminated).toBe(true);
    expect(await player.turn(game([marshal(5, 9), marshal(5, 1), soldier(5, 7)]))).toEqual({
      ok: false,
      failure: { code: 'sha-mismatch', message: 'sha256 differs' },
    });
    expect(workers).toHaveLength(1);
  });

  it('retry forgets a failure to start: the next turn starts a fresh worker', async () => {
    const { player, worker } = setup();
    const first = player.turn(game([marshal(5, 9), marshal(5, 1)]));
    const w = await worker();
    w.emit('message', { id: w.init().id, err: 'sha256 differs', code: 'sha-mismatch' });
    expect(await first).toMatchObject({ ok: false, failure: { code: 'sha-mismatch' } });
    player.retry();
    void player.turn(game([marshal(5, 9), marshal(5, 1)]));
    expect((await worker(2)).init().type).toBe('init');
  });

  it('reports a model that does not load, with no worker and no move, until the player retries', async () => {
    const altered = MODEL.slice();
    altered[0] = (altered[0] ?? 0) ^ 1;
    const { player, workers, server } = setup({ model: altered });
    expect(await player.turn(game([marshal(5, 9), marshal(5, 1)]))).toMatchObject({ ok: false, failure: { code: 'sha-mismatch' } });
    expect(await player.turn(game([marshal(5, 9), marshal(5, 1)]))).toMatchObject({ ok: false, failure: { code: 'sha-mismatch' } });
    expect(server.requests.filter((url) => url === CARD_URL)).toHaveLength(1);
    expect(workers).toHaveLength(0);
    player.retry();
    await player.turn(game([marshal(5, 9), marshal(5, 1)]));
    expect(server.requests.filter((url) => url === CARD_URL)).toHaveLength(2);
  });

  it('treats a worker crash before it is ready as a failure to start, and after it as a lost search', async () => {
    const early = setup();
    const before = early.player.turn(game([]));
    (await early.worker()).emit('error', 'script error');
    expect(await before).toMatchObject({ ok: false, failure: { code: 'worker-crash' } });

    const late = setup();
    const during = late.player.turn(game([marshal(5, 9), marshal(5, 1)]));
    const w = await late.worker();
    w.ready();
    await late.searched();
    w.emit('error', 'out of memory');
    expect(await during).toMatchObject({ ok: false, failure: { code: 'worker-crash' } });
    void late.player.turn(game([marshal(5, 9), marshal(5, 1), soldier(5, 7)]));
    await late.worker(2);
  });

  it('abandons the worker when a different search replaces the one under way', async () => {
    const { player, workers, worker, searched } = setup();
    const old = player.turn(game([marshal(5, 9), marshal(5, 1)]));
    (await worker()).ready();
    await searched();
    void player.turn(game([marshal(5, 9), marshal(5, 2)]));
    expect(await old).toMatchObject({ ok: false, failure: { code: 'cancelled' } });
    expect(workers[0]?.terminated).toBe(true);
    await worker(2);
  });

  it('refuses positions Komugi does not play, without loading anything', async () => {
    const { player, workers, server } = setup();
    const beginner = initialPosition('beginner');
    expect(await player.turn({ position: beginner, start: beginner, moves: [], level: 'focused' })).toMatchObject({ ok: false, failure: { code: 'bridge-error' } });
    expect(workers).toHaveLength(0);
    expect(server.requests).toEqual([]);
  });

  it('keeps every reply move legal in its position', async () => {
    const { player, worker, searched } = setup();
    const input = game([marshal(5, 9), marshal(5, 1)]);
    const turn = player.turn(input);
    const w = await worker();
    w.ready();
    answer(w, await searched(), 'D:soldier@7-5');
    const result = await turn;
    if (!result.ok) throw new Error(result.failure.message);
    expect(legalMoves(input.position).map(moveToString)).toContain(moveToString(result.moves[0]!));
  });

  it("plays a legal move through the package's worker host (a fake network in place of onnxruntime-web)", async () => {
    const fakeEnvironment = async (): Promise<WorkerInitEnv> => {
      const leaf = makeFakeMlhEvaluator(ACTION_SIZE);
      const session: ProbeSession = { warmup: async () => undefined, run: async () => undefined };
      return {
        sessionFactory: { setNumThreads: () => undefined, createWebgpu: async () => session, createWasm: async () => session },
        createBatchBackend: () => (states) => states.map(leaf),
        isolated: false,
        hardwareConcurrency: 4,
      };
    };
    // The page and the worker scope, wired to each other in this thread.
    const createWorker = (): KomugiWorkerLike => {
      const page = new FakeWorker();
      const scope: { listener: ((event: { data: unknown }) => void) | null } = { listener: null };
      installWorkerHost(
        { addEventListener: (_type, listener) => (scope.listener = listener), postMessage: (reply) => queueMicrotask(() => page.emit('message', reply)) },
        { makeInitEnv: fakeEnvironment },
      );
      page.postMessage = (message) => queueMicrotask(() => scope.listener?.({ data: message }));
      return page;
    };
    const { player } = setup({ createWorker });
    const input = game([marshal(5, 9), marshal(5, 1), soldier(5, 7)], 'casual');
    const result = await player.turn(input);
    if (!result.ok) throw new Error(`${result.failure.code}: ${result.failure.message}`);
    expect(result.stats?.rules).toBe('ligungi');
    expect(result.stats?.sims).toBe(LEVELS.casual.playouts);
    expect(legalMoves(input.position).map(moveToString)).toContain(moveToString(result.moves[0]!));
  });
});

describe('komugi assets', () => {
  const ORT = { schemaVersion: 1, ortVersion: '1.31.1', wasm: { mjs: { path: 'ort-1.31.1/ort-wasm-simd-threaded.mjs' }, wasm: { path: 'ort-1.31.1/ort-wasm-simd-threaded.wasm' } } };
  const INDEX = { schemaVersion: 1, recommended: { advanced: CARD.id }, models: { [CARD.id]: { card: `${CARD.id}.card.json`, onnxSha256: SHA256 } } };
  const site = (files: Record<string, unknown>) => async (url: string) => (url in files ? Response.json(files[url]) : new Response('<!doctype html>', { status: 404 }));

  it('reads what the assets step installed, as absolute URLs', async () => {
    const found = await findKomugiAssets('http://localhost/computer', site({ 'http://localhost/komugi/ort-assets.json': ORT, 'http://localhost/komugi/models.json': INDEX }));
    expect(found).toEqual(ASSETS);
    const webgpu = { mjs: { path: 'ort-1.31.1/ort-wasm-simd-threaded.asyncify.mjs' }, wasm: { path: 'ort-1.31.1/ort-wasm-simd-threaded.asyncify.wasm' } };
    const both = await findKomugiAssets('http://localhost/', site({ 'http://localhost/komugi/ort-assets.json': { ...ORT, webgpu }, 'http://localhost/komugi/models.json': INDEX }));
    expect(both?.ortAssets.webgpu).toEqual({ mjs: 'http://localhost/komugi/ort-1.31.1/ort-wasm-simd-threaded.asyncify.mjs', wasm: 'http://localhost/komugi/ort-1.31.1/ort-wasm-simd-threaded.asyncify.wasm' });
  });

  it('finds none when the files are missing, malformed, or recommend no model for Advanced', async () => {
    const files = { 'http://localhost/komugi/ort-assets.json': ORT, 'http://localhost/komugi/models.json': INDEX };
    expect(await findKomugiAssets('http://localhost/', site({}))).toBeNull();
    expect(await findKomugiAssets('http://localhost/', site({ ...files, 'http://localhost/komugi/models.json': { ...INDEX, recommended: {} } }))).toBeNull();
    expect(await findKomugiAssets('http://localhost/', site({ ...files, 'http://localhost/komugi/ort-assets.json': { wasm: {} } }))).toBeNull();
    // The Vite dev server answers its HTML page for a missing file.
    expect(await findKomugiAssets('http://localhost/', async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }))).toBeNull();
    expect(await findKomugiAssets('http://localhost/', async () => Promise.reject(new Error('offline')))).toBeNull();
  });
});
