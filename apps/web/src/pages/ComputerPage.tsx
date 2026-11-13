import { BOT_LEVELS, type BotLevel } from '@ligungi/bot';
import { MODES, MODE_RULES, initialPosition, legalMoves, moveToString, opposite, parseMove, repetitionKey, toFen, type Color, type Mode } from '@ligungi/engine';
import type { ColorChoice } from '@ligungi/protocol';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { RoundLayout, type RoundPlayer } from '../components/RoundLayout.tsx';
import { Checkbox, Field, RadioGroup, Select, SubmitButton } from '../components/ui.tsx';
import { icons } from '../icons.ts';
import { colorChoiceOptions, outcomeText, useT } from '../i18n/index.ts';
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
    // Earlier positions of the game, so the bot can tell when a move would repeat one.
    const history = replay.positions.slice(0, -1).filter((p) => p.phase === 'play').map(repetitionKey);
    worker.current.postMessage({ id, fen: toFen(position), level, history });
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

  const colorOptions = colorChoiceOptions(t);

  if (!me) {
    return (
      <main class="page-small box box-pad page ligungi-setup">
        <h1 class="box__top">{t.computer.title}</h1>
        <form class="form3" onSubmit={(e) => (e.preventDefault(), start())}>
          <Field label={t.common.mode} htmlFor="ai-mode" help={t.modeDescriptions[mode]}>
            <Select id="ai-mode" value={mode} options={MODES.map((m) => ({ value: m, label: t.modes[m] }))} onChange={setMode} />
          </Field>
          {MODE_RULES[mode].draft && (
            <Checkbox id="ai-free" checked={freeDraft} onChange={setFreeDraft} label={t.freeDraftLabel} help={t.freeDraftHint} />
          )}
          <Field label={t.computer.strength} htmlFor="ai-level">
            <Select id="ai-level" value={level} options={BOT_LEVELS.map((l) => ({ value: l, label: t.computer.levels[l] }))} onChange={setLevel} />
          </Field>
          <Field label={t.common.yourColor}>
            <RadioGroup name="ai-color" value={colorChoice} options={colorOptions} onChange={setColorChoice} />
          </Field>
          <Field label={t.common.whoStarts}>
            <RadioGroup name="ai-first" value={firstChoice} options={colorOptions} onChange={setFirstChoice} />
          </Field>
          <SubmitButton>{t.computer.start}</SubmitButton>
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
