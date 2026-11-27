// The page's side of the Komugi opponent: finds the files `scripts/komugi-assets.sh` installs, loads the
// model, runs the engine through KomugiClient, builds each search with the bridge and maps the reply back.
// Every failure comes back as a value: the page shows it and offers Try again, and no other engine ever
// moves in Komugi's place.

import { KomugiClient, loadModel, resolveLevel } from '@komugi-ai/engine';
import type { KomugiFailureCode as EngineFailureCode, KomugiOrtAssets, KomugiWorkerFactory, LevelName, LoadModelOptions, WorkerReplyOk, WorkerStats } from '@komugi-ai/engine';
import { initialPosition, moveToString, toFen, type Color, type Move, type Position } from '@ligungi/engine';
import { KOMUGI_RULES, komugiPlays, komugiReplyMapper, komugiSearchInput, pendingDone, type KomugiSearchInput } from './bridge.ts';

/** The engine's codes, plus a game or reply the bridge cannot translate, and a search replaced or stopped. */
export type KomugiFailureCode = EngineFailureCode | 'bridge-error' | 'cancelled';
export type KomugiFailure = { readonly code: KomugiFailureCode; readonly message: string };

/** onnxruntime-web's files and the model card, as absolute URLs. */
export type KomugiAssets = { readonly ortAssets: KomugiOrtAssets; readonly cardUrl: string };

export const KOMUGI_ASSETS_PATH = '/komugi/ort-assets.json';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const field = (value: unknown, keys: readonly string[]): unknown => keys.reduce((inner, key) => (isRecord(inner) ? inner[key] : undefined), value);

const text = (value: unknown, ...keys: string[]): string => {
  const found = field(value, keys);
  if (typeof found !== 'string') throw new Error(`${keys.join('.')} is not a string`);
  return found;
};

// The JSON files and the model keep their names across releases, so the HTTP cache must revalidate them.
// loadModel keeps verified models in Cache Storage, so revalidating never downloads a model twice.
const fresh = (url: string): Promise<Response> => fetch(url, { cache: 'no-cache' });

/** The installed assets, or null when there are none (a 404, or the dev server's HTML page in their place). */
export const findKomugiAssets = async (base: string, fetcher: (url: string) => Promise<Response> = fresh): Promise<KomugiAssets | null> => {
  const url = new URL(KOMUGI_ASSETS_PATH, base).href;
  const json = async (path: string): Promise<unknown> => {
    const response = await fetcher(new URL(path, url).href);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };
  try {
    const [ort, index] = await Promise.all([json(url), json('models.json')]);
    const at = (path: string): string => new URL(path, url).href;
    const pair = (kind: string) => ({ mjs: at(text(ort, kind, 'mjs', 'path')), wasm: at(text(ort, kind, 'wasm', 'path')) });
    const cardUrl = at(text(index, 'models', text(index, 'recommended', 'advanced'), 'card'));
    return { ortAssets: { wasm: pair('wasm'), ...(field(ort, ['webgpu']) ? { webgpu: pair('webgpu') } : {}) }, cardUrl };
  } catch {
    return null;
  }
};

export type KomugiTurnInput = { readonly position: Position; readonly start: Position; readonly moves: readonly Move[]; readonly level: LevelName };

/** `stats` is null when nothing was searched: the `done` owed after Komugi's last placement. */
export type KomugiTurn = { readonly ok: true; readonly moves: readonly Move[]; readonly stats: WorkerStats | null } | { readonly ok: false; readonly failure: KomugiFailure };

/** `load` reaches loadModel (tests pass a fake fetch). */
export type KomugiPlayerOptions = { readonly assets: KomugiAssets; readonly createWorker: KomugiWorkerFactory; readonly load?: LoadModelOptions };

type Search = { readonly ok: true; readonly reply: WorkerReplyOk } | { readonly ok: false; readonly failure: KomugiFailure };

const ADVANCED_START = toFen(initialPosition('advanced', 'white'));
// The worker fetches onnxruntime-web's runtime, 15 MB (44 MB with WebGPU): about 80 s over a slow 5 Mbit/s link.
const INIT_TIMEOUT_MS = 90_000;
const failed = (code: KomugiFailureCode, message: string) => ({ ok: false, failure: { code, message } }) as const;
const CANCELLED = failed('cancelled', 'Replaced by another search, or stopped');
const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * The Komugi opponent of one page. One search runs at a time: asking again for the search under way (the
 * page does when its effect runs again) shares it, asking for another one stops it. The model loads once;
 * a failure to load it or to start the engine stays until the player asks to try again (`retry`).
 */
export class KomugiPlayer {
  readonly #options: KomugiPlayerOptions;
  #client: Promise<KomugiClient | KomugiFailure> | null = null;
  /** What `#client` resolved to. */
  #ready: KomugiClient | KomugiFailure | null = null;
  #search: { readonly key: string; result: Promise<Search> } | null = null;
  #answered: { readonly key: string; readonly result: Search } | null = null;
  /** After a 終 placement that could not end the draft in the same turn: who owes `done`, and the game up to that placement. */
  #owedDone: { readonly side: Color; readonly moves: readonly string[] } | null = null;
  #disposed = false;

  constructor(options: KomugiPlayerOptions) {
    this.#options = options;
  }

  /** Loads the model and starts the engine ahead of the first move. */
  prepare(): void {
    void this.#load().then((client) => (client instanceof KomugiClient ? client.init() : null));
  }

  retry(): void {
    if (this.#ready instanceof KomugiClient) this.#ready.retry();
    else if (this.#ready) this.#client = this.#ready = null;
  }

  /** A new game: forgets the previous one. */
  reset(): void {
    this.#owedDone = null;
    this.#answered = null;
  }

  /** Stops the search under way, if any; its turn fails as `cancelled`. */
  cancel(): void {
    if (!this.#search) return;
    this.#search = null;
    if (this.#ready instanceof KomugiClient) this.#ready.stop();
  }

  dispose(): void {
    this.cancel();
    this.#disposed = true;
    if (this.#ready instanceof KomugiClient) this.#ready.dispose();
  }

  /** Komugi's moves in the position the game has reached, or why it has none. */
  async turn(input: KomugiTurnInput): Promise<KomugiTurn> {
    const { position } = input;
    if (!komugiPlays(position)) return failed('bridge-error', 'Komugi does not play this position');
    try {
      const played = input.moves.map(moveToString);
      const owed = this.#owedDone;
      this.#owedDone = null;
      const done = owed?.side === position.turn && owed.moves.every((move, index) => played[index] === move) ? pendingDone(position, owed.side) : null;
      if (done) return { ok: true, moves: [done], stats: null };
      const search = komugiSearchInput(position, toFen(input.start) === ADVANCED_START ? input.moves : undefined);
      const result = await this.#run(search, input.level);
      if (!result.ok) return result;
      const { moves, doneNextTurn } = komugiReplyMapper(position)(result.reply);
      if (doneNextTurn) this.#owedDone = { side: position.turn, moves: [...played, ...moves.map(moveToString)] };
      return { ok: true, moves, stats: result.reply.stats };
    } catch (error) {
      return failed('bridge-error', errorText(error));
    }
  }

  #load(): Promise<KomugiClient | KomugiFailure> {
    const { assets, createWorker, load } = this.#options;
    return (this.#client ??= loadModel({ manifestUrl: assets.cardUrl }, { fetch: fresh, ...load }).then((loaded) => {
      if (loaded.status === 'failed') return (this.#ready = { code: loaded.failure.code, message: loaded.failure.message });
      if (this.#disposed) loaded.model.release?.();
      if (this.#disposed) return CANCELLED.failure;
      return (this.#ready = new KomugiClient({ createWorker, model: loaded.model, ortAssets: assets.ortAssets, initTimeoutMs: INIT_TIMEOUT_MS }));
    }));
  }

  #run(search: KomugiSearchInput, level: LevelName): Promise<Search> {
    const key = JSON.stringify([search, level]);
    if (this.#answered?.key === key) return Promise.resolve(this.#answered.result);
    if (this.#search?.key === key) return this.#search.result;
    this.cancel();
    const entry: { readonly key: string; result: Promise<Search> } = { key, result: Promise.resolve(CANCELLED) };
    this.#search = entry;
    entry.result = this.#play(entry, search, level).then((result) => {
      if (this.#search === entry) this.#search = null;
      if (result.ok) this.#answered = { key, result };
      return result;
    });
    return entry.result;
  }

  async #play(entry: object, { fen, history }: KomugiSearchInput, level: LevelName): Promise<Search> {
    const live = () => this.#search === entry;
    try {
      const client = await this.#load();
      if (!(client instanceof KomugiClient)) return { ok: false, failure: client };
      const ready = await client.init();
      if (!live()) return CANCELLED;
      if (ready.status === 'failed') return failed(ready.failure.code, ready.failure.message);
      // The level's playouts and time cap, at the batch size that suits the backend the engine picked.
      const played = await client.play({ fen, history, rules: KOMUGI_RULES, ...resolveLevel(level, ready.info) });
      if (played.status === 'move') return { ok: true, reply: played.reply };
      return played.status === 'failed' && live() ? failed(played.failure.code, played.failure.message) : CANCELLED;
    } catch (error) {
      return live() ? failed('worker-crash', errorText(error)) : CANCELLED;
    }
  }
}
