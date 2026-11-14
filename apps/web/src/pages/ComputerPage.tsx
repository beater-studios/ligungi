import { BOT_LEVELS, type BotLevel } from '@ligungi/bot';
import { MODES, MODE_RULES, initialPosition, legalMoves, moveToString, opposite, parseMove, repetitionKey, toFen, type Color, type Mode } from '@ligungi/engine';
import type { ColorChoice } from '@ligungi/protocol';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { RoundLayout, type RoundPlayer } from '../components/RoundLayout.tsx';
import { Checkbox, OptionCards, SubmitButton } from '../components/ui.tsx';
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
  const disc = (color: ColorChoice) => <span class={`ligungi-choice__disc ligungi-choice__disc--${color}`} aria-hidden="true" />;

  if (!me) {
    return (
      <main class="ligungi-page ligungi-computer">
        <form class="ligungi-card ligungi-computer__form" onSubmit={(e) => (e.preventDefault(), start())}>
          <header class="ligungi-computer__head">
            <h1>{t.computer.title}</h1>
            <p>{t.computer.intro}</p>
          </header>
          <OptionCards
            name="ai-level"
            legend={t.computer.strength}
            value={level}
            options={BOT_LEVELS.map((l) => ({ value: l, badge: l, label: t.computer.levelNames[l], hint: t.computer.levelHints[l] }))}
            onChange={setLevel}
          />
          <OptionCards
            name="ai-mode"
            legend={t.common.mode}
            layout="segmented"
            value={mode}
            options={MODES.map((m) => ({ value: m, label: t.modes[m] }))}
            onChange={setMode}
            help={t.modeDescriptions[mode]}
          />
          {MODE_RULES[mode].draft && (
            <Checkbox id="ai-free" checked={freeDraft} onChange={setFreeDraft} label={t.freeDraftLabel} help={t.freeDraftHint} />
          )}
          <div class="ligungi-computer__pair">
            <OptionCards
              name="ai-color"
              legend={t.common.yourColor}
              layout="row"
              value={colorChoice}
              options={colorOptions.map((option) => ({ ...option, icon: disc(option.value) }))}
              onChange={setColorChoice}
            />
            <OptionCards name="ai-first" legend={t.common.whoStarts} layout="row" value={firstChoice} options={colorOptions} onChange={setFirstChoice} />
          </div>
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
                {t.done}
              </button>
            )}
            <button
              type="button"
              class="fbt ligungi-ctl"
              title={t.common.takeback}
              data-icon={icons.Back}
              disabled={thinking || replay.moves.length === 0}
              onClick={() => local.undo(position.turn === me ? 2 : 1)}
            >
              <span>{t.game.ctlTakeback}</span>
            </button>
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
        <section class="ligungi-card ligungi-game-info">
          <p class="ligungi-game-info__setup">
            {t.modes[local.start.mode]} · {t.computer.bot(level)} · {t.computer.levelNames[level]}
          </p>
          {local.start.freeDraft && <p class="ligungi-notice">{t.freeDraftHint}</p>}
          <button type="button" class="button button-empty" onClick={() => setMe(null)}>
            {t.common.newGame}
          </button>
        </section>
      }
    />
  );
};
