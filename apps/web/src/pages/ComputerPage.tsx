import { BOT_LEVELS, type BotLevel } from '@ligungi/bot';
import { MODES, MODE_RULES, initialPosition, legalMoves, moveToString, opposite, parseMove, toFen, type Color, type Mode } from '@ligungi/engine';
import type { ColorChoice } from '@ligungi/protocol';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { RoundLayout, type RoundPlayer } from '../components/RoundLayout.tsx';
import { icons } from '../icons.ts';
import { outcomeText, useT } from '../i18n/index.ts';
import { useLocalGame } from '../localGame.ts';
import { playSound } from '../sound.ts';

const MIN_THINK_MS = 450;

const pick = (choice: ColorChoice): Color => (choice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : choice);

export const ComputerPage = () => {
  const t = useT();
  const [mode, setMode] = useState<Mode>('beginner');
  const [level, setLevel] = useState<BotLevel>(2);
  const [colorChoice, setColorChoice] = useState<ColorChoice>('white');
  const [firstChoice, setFirstChoice] = useState<ColorChoice>('white');
  const [freeDraft, setFreeDraft] = useState(false);
  const [me, setMe] = useState<Color | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [thinking, setThinking] = useState(false);
  const local = useLocalGame(initialPosition('beginner'));
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);

  useEffect(() => {
    worker.current = new Worker(new URL('../bot.worker.ts', import.meta.url), { type: 'module' });
    return () => worker.current?.terminate();
  }, []);

  const { replay } = local;
  const position = replay.game.position;
  const outcome = replay.game.outcome ?? null;
  const botColor = me ? opposite(me) : null;
  const botTurn = Boolean(me && !outcome && local.ply === null && position.turn === botColor);

  useEffect(() => {
    if (!botTurn || !worker.current) return;
    const id = ++request.current;
    const started = performance.now();
    setThinking(true);
    const onMessage = (event: MessageEvent<{ id: number; move: string }>) => {
      if (event.data.id !== id) return;
      const wait = Math.max(0, MIN_THINK_MS - (performance.now() - started));
      setTimeout(() => {
        if (request.current !== id) return;
        const move = parseMove(event.data.move);
        if (move) {
          playSound(move.kind === 'move' && move.action === 'capture' ? 'capture' : 'move');
          local.play(move);
        }
        setThinking(false);
      }, wait);
    };
    worker.current.addEventListener('message', onMessage);
    worker.current.postMessage({ id, fen: toFen(position), level });
    return () => {
      worker.current?.removeEventListener('message', onMessage);
      request.current++;
      setThinking(false);
    };
  }, [botTurn, replay]);

  useEffect(() => {
    if (outcome) playSound('notify');
  }, [Boolean(outcome)]);

  const myTurn = Boolean(me && !outcome && local.ply === null && position.turn === me);
  const moves = useMemo(() => (myTurn ? legalMoves(position) : []), [myTurn, replay]);

  const start = () => {
    const color = pick(colorChoice);
    setMe(color);
    setFlipped(false);
    local.reset(initialPosition(mode, pick(firstChoice), { freeDraft }));
    playSound('notify');
  };

  const choice = (name: string, current: ColorChoice, set: (c: ColorChoice) => void) => (
    <group class="radio">
      {(['white', 'random', 'black'] as const).map((c) => (
        <div key={c}>
          <input type="radio" id={`${name}-${c}`} name={name} checked={current === c} onChange={() => set(c)} />
          <label for={`${name}-${c}`}>{t.colorChoices[c]}</label>
        </div>
      ))}
    </group>
  );

  if (!me) {
    return (
      <main class="page-small box box-pad page ligungi-setup">
        <h1 class="box__top">{t.computer.title}</h1>
        <form class="form3" onSubmit={(e) => (e.preventDefault(), start())}>
          <div class="form-group">
            <label class="form-label" for="ai-mode">{t.common.mode}</label>
            <select id="ai-mode" class="form-control" value={mode} onChange={(e) => setMode((e.target as HTMLSelectElement).value as Mode)}>
              {MODES.map((m) => (
                <option key={m} value={m}>{t.modes[m]}</option>
              ))}
            </select>
            <small class="form-help">{t.modeDescriptions[mode]}</small>
          </div>
          {MODE_RULES[mode].draft && (
            <div class="form-group form-check">
              <input type="checkbox" id="ai-free" class="form-check-input" checked={freeDraft} onChange={(e) => setFreeDraft((e.target as HTMLInputElement).checked)} />
              <label for="ai-free" class="form-check-label">{t.freeDraftLabel}</label>
              <small class="form-help">{t.freeDraftHint}</small>
            </div>
          )}
          <div class="form-group">
            <label class="form-label" for="ai-level">{t.computer.strength}</label>
            <select id="ai-level" class="form-control" value={level} onChange={(e) => setLevel(Number((e.target as HTMLSelectElement).value) as BotLevel)}>
              {BOT_LEVELS.map((l) => (
                <option key={l} value={l}>{t.computer.levels[l]}</option>
              ))}
            </select>
          </div>
          <div class="form-group">
            <span class="form-label">{t.common.yourColor}</span>
            {choice('color', colorChoice, setColorChoice)}
          </div>
          <div class="form-group">
            <span class="form-label">{t.common.whoStarts}</span>
            {choice('first', firstChoice, setFirstChoice)}
          </div>
          <div class="form-actions single">
            <button type="submit" class="button button-fat">{t.computer.start}</button>
          </div>
        </form>
      </main>
    );
  }

  const orientation = flipped ? opposite(me) : me;
  const bot = opposite(me);
  const status = outcome
    ? outcomeText(t, outcome)
    : t.turnStatus(position.phase === 'draft', position.turn, myTurn ? 'you' : thinking ? 'thinking' : null);
  const doneAvailable = myTurn && position.phase === 'draft' && moves.some((m) => m.kind === 'done');
  const analysisLink = `/analysis?mode=${local.start.mode}&first=${local.start.firstPlayer}${local.start.freeDraft ? '&free=1' : ''}&moves=${encodeURIComponent(replay.moves.map(moveToString).join(','))}`;
  const players = {
    [me]: { name: t.common.you, first: local.start.firstPlayer === me },
    [bot]: { name: t.computer.bot(level), first: local.start.firstPlayer === bot },
  } as Record<Color, RoundPlayer>;

  return (
    <RoundLayout
      board={{
        position: local.position,
        movableColor: me,
        moves,
        lastMove: local.lastMove,
        onMove: (move) => {
          playSound(move.kind === 'move' && move.action === 'capture' ? 'capture' : 'move');
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
      controls={
        <>
          <div class="ricons">
            {doneAvailable && (
              <button type="button" class="fbt text strong glowing ligungi-done" onClick={() => local.play({ kind: 'done' })}>
                済み {t.done}
              </button>
            )}
            <button
              type="button"
              class="fbt"
              title={t.common.takeback}
              data-icon={icons.Back}
              disabled={thinking || replay.moves.length === 0}
              onClick={() => local.undo(position.turn === me ? 2 : 1)}
            />
          </div>
          {outcome && (
            <div class="follow-up">
              <button type="button" class="fbt" onClick={() => setMe(null)}>
                {t.common.newGame}
              </button>
            </div>
          )}
        </>
      }
      side={
        <div class="game__meta">
          <section>
            <div class="game__meta__infos" data-icon={icons.Cogs}>
              <div>
                <div class="header">
                  <div class="setup">
                    {t.modes[local.start.mode]} • {t.computer.levels[level]}
                    {local.start.freeDraft && <span title={t.freeDraftHint}> • {t.freeDraft}</span>}
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section class="ligungi-links">
            <button type="button" class="button button-empty" onClick={() => setMe(null)}>
              {t.common.newGame}
            </button>
          </section>
        </div>
      }
    />
  );
};
