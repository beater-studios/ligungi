import { DEFAULT_LEVEL, LEVELS, LEVEL_NAMES, type LevelName } from '@komugi-ai/engine';
import { BOT_LEVELS, type BotLevel } from '@ligungi/bot';
import {
  MODES,
  MODE_RULES,
  applyMove,
  initialPosition,
  legalMoves,
  moveToString,
  opposite,
  parseFen,
  parseMove,
  positionProblems,
  repetitionKey,
  toFen,
  type Color,
  type Mode,
  type Move,
  type Position,
} from '@ligungi/engine';
import type { ColorChoice } from '@ligungi/protocol';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { usePresence } from '../presence.ts';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { RoundLayout, type RoundPlayer } from '../game/RoundLayout.tsx';
import { Checkbox, OptionCards, SubmitButton } from '../components/ui.tsx';
import { OPPONENTS, computerForm, computerStart, type KomugiModelState, type Opponent } from './computer/computerOptions.ts';
import { icons } from '../icons.ts';
import { colorChoiceOptions, outcomeText, useT } from '../i18n/index.ts';
import { KomugiPlayer, findKomugiAssets, type KomugiAssets, type KomugiFailure } from '../komugi/client.ts';
import { useLocalGame } from '../game/localGame.ts';
import { useLocation } from '../core/router.ts';
import { playSound } from '../sound.ts';
import { moveSound } from '../blind/speech.ts';

const MIN_THINK_MS = 450;

const pick = (choice: ColorChoice): Color => (choice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : choice);

/** A start position from the address (`?fen=`, from the board editor or the analysis), when it is one a game can reach. */
const startFrom = (search: string): Position | null => {
  const fen = new URLSearchParams(search).get('fen');
  if (!fen) return null;
  try {
    const position = parseFen(fen);
    return positionProblems(position).length === 0 && legalMoves(position).length > 0 ? position : null;
  } catch {
    return null;
  }
};

const createKomugiWorker = () => new Worker(new URL('../komugi/engine.worker.ts', import.meta.url), { type: 'module' });

type FailureReason = 'model' | 'time' | 'engine';

const MODEL_FAILURES: readonly KomugiFailure['code'][] = ['model-fetch', 'sha-mismatch', 'incompatible-model', 'model-not-found'];

const failureReason = (failure: KomugiFailure): FailureReason => {
  if (MODEL_FAILURES.includes(failure.code)) return 'model';
  return failure.code === 'timeout' ? 'time' : 'engine';
};

/** A turn's moves, or why the opponent made none. */
type TurnResult = { readonly moves: readonly Move[]; readonly failure: KomugiFailure | null };

export const ComputerPage = () => {
  const t = useT();
  const { search } = useLocation();
  const custom = useMemo(() => startFrom(search), [search]);
  const [opponent, setOpponent] = useState<Opponent>('builtin');
  const [mode, setMode] = useState<Mode>('beginner');
  const [level, setLevel] = useState<BotLevel>(2);
  const [strength, setStrength] = useState<LevelName>(DEFAULT_LEVEL);
  const [colorChoice, setColorChoice] = useState<ColorChoice>('white');
  const [freeDraft, setFreeDraft] = useState(false);
  const [assets, setAssets] = useState<KomugiAssets | null | 'loading'>('loading');
  const [me, setMe] = useState<Color | null>(null);
  /** The opponent of the game being played. */
  const [rival, setRival] = useState<Opponent>('builtin');
  /** Why Komugi could not make its move; the game waits for the player to retry or start over. */
  const [failure, setFailure] = useState<FailureReason | null>(null);
  /** Bumped by Retry, to ask Komugi for the same move again. */
  const [attempt, setAttempt] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [thinking, setThinking] = useState(false);
  const local = useLocalGame(initialPosition('beginner'));
  const worker = useRef<Worker | null>(null);
  const komugi = useRef<KomugiPlayer | null>(null);
  const request = useRef(0);
  const builtinRequest = useRef(0);

  useEffect(() => {
    worker.current = new Worker(new URL('../game/bot.worker.ts', import.meta.url), { type: 'module' });
    let live = true;
    void findKomugiAssets(location.href).then((found) => {
      if (live) setAssets(found);
    });
    return () => {
      live = false;
      worker.current?.terminate();
      komugi.current?.dispose();
      komugi.current = null;
    };
  }, []);

  const modelState: KomugiModelState = assets === 'loading' ? 'loading' : assets ? 'installed' : 'missing';
  const form = computerForm({ opponent, mode, freeDraft }, { custom, model: modelState });

  const { replay } = local;
  const position = replay.game.position;
  const outcome = replay.game.outcome ?? null;
  const botColor = me ? opposite(me) : null;
  const botTurn = Boolean(me && !outcome && local.ply === null && position.turn === botColor);
  // A game against Komugi has a strength, not one of the built-in levels.
  const opponentPresence = rival === 'komugi' ? { opponent: 'komugi', strength } : { level: String(level) };
  usePresence(me && { kind: 'computer', mode: local.start.mode, ...opponentPresence, color: me, status: outcome ? 'ended' : 'started' });

  /** The built-in bot's move; `history` holds the repetition keys of the earlier positions of the game. */
  const builtinMove = (from: Position, botLevel: BotLevel, history: readonly string[]): Promise<Move | null> =>
    new Promise((resolve) => {
      const bot = worker.current;
      if (!bot) return resolve(null);
      const id = ++builtinRequest.current;
      const onMessage = (event: MessageEvent<{ id: number; move: string }>) => {
        if (event.data.id !== id) return;
        bot.removeEventListener('message', onMessage);
        resolve(parseMove(event.data.move) ?? null);
      };
      bot.addEventListener('message', onMessage);
      bot.postMessage({ id, fen: toFen(from), level: botLevel, history });
    });

  useEffect(() => {
    if (!botTurn || failure) return;
    const id = ++request.current;
    const started = performance.now();
    setThinking(true);
    const from = position;
    // Earlier positions of the game, so the built-in bot can tell when a move would repeat one.
    const history = replay.positions.slice(0, -1).filter((p) => p.phase === 'play').map(repetitionKey);
    const player = komugi.current;
    // The opponent the player picked always moves: Komugi in a Komugi game, never another engine in its place.
    const chosen: Promise<TurnResult> =
      rival === 'komugi'
        ? player
          ? player.turn({ position: from, start: local.start, moves: replay.moves, level: strength }).then((turn) => (turn.ok ? { moves: turn.moves, failure: null } : { moves: [], failure: turn.failure }))
          : Promise.resolve({ moves: [], failure: { code: 'model-fetch', message: 'Komugi is not available' } })
        : builtinMove(from, level, history).then((move) => ({ moves: move ? [move] : [], failure: null }));
    void chosen.then(({ moves, failure: why }) => {
      if (request.current !== id) return;
      const wait = Math.max(0, MIN_THINK_MS - (performance.now() - started));
      setTimeout(() => {
        if (request.current !== id) return;
        if (why) {
          // A cancelled turn belongs to a game or position the player has already left.
          if (why.code !== 'cancelled') setFailure(failureReason(why));
          setThinking(false);
          return;
        }
        let at = from;
        for (const move of moves) {
          if (move.kind !== 'done') moveSound('computer', at, move, 'opponent');
          at = applyMove(at, move);
          local.play(move);
        }
        setThinking(false);
      }, wait);
    });
    return () => {
      request.current++;
      setThinking(false);
    };
  }, [botTurn, replay, failure, attempt]);

  const retry = () => {
    komugi.current?.retry();
    setFailure(null);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    if (outcome) playSound('notify');
  }, [Boolean(outcome)]);

  const myTurn = Boolean(me && !outcome && local.ply === null && position.turn === me);
  const moves = useMemo(() => (myTurn ? legalMoves(position) : []), [myTurn, replay]);

  const start = () => {
    const color = pick(colorChoice);
    setMe(color);
    setFlipped(false);
    setRival(form.opponent);
    setFailure(null);
    if (form.opponent === 'komugi' && assets !== 'loading' && assets) {
      komugi.current ??= new KomugiPlayer({ assets, createWorker: createKomugiWorker });
      komugi.current.reset();
      komugi.current.prepare();
    }
    local.reset(computerStart(form, custom));
    playSound('notify');
  };

  const newGame = () => {
    komugi.current?.cancel();
    setMe(null);
  };

  const colorOptions = colorChoiceOptions(t);
  const disc = (color: ColorChoice) => <span class={`ligungi-choice__disc ligungi-choice__disc--${color}`} aria-hidden="true" />;

  if (!me) {
    const komugiPicked = form.opponent === 'komugi';
    // Why Komugi is greyed out, said once beside the opponents (and as the card's tooltip).
    const komugiWhy =
      form.komugiUnavailable === 'mode'
        ? t.computer.komugiAdvancedOnly
        : form.komugiUnavailable === 'freeDraft'
          ? t.computer.komugiRulebookDraft
          : form.komugiUnavailable === 'missing'
            ? t.computer.komugiMissing
            : undefined;
    const opponentHelp = komugiPicked ? t.computer.komugiDownload : komugiWhy;
    return (
      <main class="ligungi-page ligungi-computer">
        <form class="ligungi-card ligungi-computer__form" onSubmit={(e) => (e.preventDefault(), start())}>
          <header class="ligungi-computer__head">
            <h1>{t.computer.title}</h1>
            <p>{t.computer.intro}</p>
          </header>
          {/* The format first, then the opponents that play it. */}
          {custom ? (
            <div class="ligungi-computer__custom">
              <div class="ligungi-computer__custom-board">
                <MiniBoard position={custom} />
              </div>
              <p>
                {t.computer.fromPosition(t.modes[custom.mode], custom.turn)} <a href="/computer">{t.computer.normalGame}</a>
              </p>
            </div>
          ) : (
            <>
              <OptionCards
                name="ai-mode"
                legend={t.common.mode}
                layout="segmented"
                value={form.mode}
                options={MODES.map((m) => ({ value: m, label: t.modes[m] }))}
                onChange={setMode}
                help={t.modeDescriptions[form.mode]}
              />
              {MODE_RULES[form.mode].draft && (
                <Checkbox id="ai-free" checked={form.freeDraft} onChange={setFreeDraft} label={t.freeDraftLabel} help={t.freeDraftHint} />
              )}
            </>
          )}
          {form.komugiShown && (
            <OptionCards
              name="ai-opponent"
              legend={t.computer.opponent}
              value={form.opponent}
              options={OPPONENTS.map((o) => ({
                value: o,
                label: t.computer.opponents[o],
                hint: t.computer.opponentHints[o],
                ...(o === 'komugi' && form.komugiUnavailable !== null ? { disabled: true } : {}),
                ...(o === 'komugi' && komugiWhy ? { title: komugiWhy } : {}),
              }))}
              onChange={setOpponent}
              help={opponentHelp}
            />
          )}
          {komugiPicked ? (
            <OptionCards
              name="ai-strength"
              legend={t.computer.strength}
              value={strength}
              options={LEVEL_NAMES.map((s) => ({ value: s, label: t.computer.strengths[s], hint: t.computer.strengthHints[s](Math.ceil(LEVELS[s].capMs / 1000)) }))}
              onChange={setStrength}
            />
          ) : (
            <OptionCards
              name="ai-level"
              legend={t.computer.level}
              value={level}
              options={BOT_LEVELS.map((l) => ({ value: l, badge: l, label: t.computer.levelNames[l], hint: t.computer.levelHints[l] }))}
              onChange={setLevel}
            />
          )}
          <OptionCards
            name="ai-color"
            legend={t.common.yourColor}
            layout="row"
            value={colorChoice}
            options={colorOptions.map((option) => ({ ...option, icon: disc(option.value) }))}
            onChange={setColorChoice}
            help={custom ? undefined : t.common.whiteStarts}
          />
          <SubmitButton>{t.computer.start}</SubmitButton>
        </form>
      </main>
    );
  }

  const orientation = flipped ? opposite(me) : me;
  const bot = opposite(me);
  const botName = rival === 'komugi' ? t.computer.komugiBot(t.computer.strengths[strength]) : t.computer.bot(level);
  const status = outcome
    ? outcomeText(t, outcome)
    : t.turnStatus(position.phase === 'draft', position.turn, myTurn ? 'you' : thinking ? 'thinking' : null);
  const doneAvailable = myTurn && position.phase === 'draft' && moves.some((m) => m.kind === 'done');
  // A game from a set-up position cannot be replayed from the mode's start: the analysis opens on where it stands.
  const analysisLink = custom
    ? `/analysis?fen=${encodeURIComponent(toFen(position))}`
    : `/analysis?mode=${local.start.mode}&first=${local.start.firstPlayer}${local.start.freeDraft ? '&free=1' : ''}&moves=${encodeURIComponent(replay.moves.map(moveToString).join(','))}`;
  const players = {
    [me]: { name: t.common.you, first: local.start.firstPlayer === me },
    [bot]: { name: botName, first: local.start.firstPlayer === bot },
  } as Record<Color, RoundPlayer>;

  return (
    <RoundLayout
      heading={t.computer.title}
      training
      board={{
        position: local.position,
        movableColor: me,
        moves,
        lastMove: local.lastMove,
        onMove: (move) => {
          moveSound('computer', local.position, move, 'self');
          local.play(move);
        },
      }}
      orientation={orientation}
      players={players}
      turn={outcome ? null : position.turn}
      positions={replay.positions}
      moves={replay.moves}
      ply={local.ply}
      onPly={local.setPly}
      onFlip={() => setFlipped((f) => !f)}
      analysisHref={analysisLink}
      myTurn={myTurn}
      status={status}
      result={outcome ? outcomeText(t, outcome) : null}
      controls={
        <>
          <div class="ricons">
            {doneAvailable && (
              <button type="button" class="fbt text strong glowing ligungi-done" onClick={() => local.play({ kind: 'done' })}>
                {t.done}
              </button>
            )}
            <button
              type="button"
              class="fbt ligungi-ctl"
              title={t.common.takeback}
              data-icon={icons.Back}
              disabled={thinking || replay.moves.length === 0}
              onClick={() => {
                setFailure(null);
                local.undo(position.turn === me ? 2 : 1);
              }}
            >
              <span>{t.game.ctlTakeback}</span>
            </button>
          </div>
          {outcome && (
            <div class="follow-up">
              <button type="button" class="fbt" onClick={newGame}>
                {t.common.newGame}
              </button>
            </div>
          )}
        </>
      }
      side={
        <section class="ligungi-card ligungi-game-info">
          <p class="ligungi-game-info__setup">
            {t.modes[local.start.mode]} · {rival === 'komugi' ? botName : `${botName} · ${t.computer.levelNames[level]}`}
          </p>
          {local.start.freeDraft && <p class="ligungi-notice">{t.freeDraftHint}</p>}
          {failure && (
            <div class="ligungi-notice" role="alert">
              <p>
                {t.computer.komugiFailed} {t.computer.komugiFailedReasons[failure]}
              </p>
              <button type="button" class="button" onClick={retry}>
                {t.computer.retry}
              </button>
            </div>
          )}
          <button type="button" class="button button-empty" onClick={newGame}>
            {t.common.newGame}
          </button>
        </section>
      }
    />
  );
};
