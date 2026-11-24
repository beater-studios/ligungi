import { initialPosition, parseFen, parseSquare } from '@ligungi/engine';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { FeedList } from '../components/Activity.tsx';
import { TowerStrip } from '../components/Panels.tsx';
import { BlindPanel } from '../components/BlindPanel.tsx';
import { BoardView } from '../components/BoardView.tsx';
import { CrosstableView } from '../components/Crosstable.tsx';
import { RatingTrend } from '../components/RatingTrend.tsx';
import { Flag } from '../components/Flag.tsx';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { PlayerTag } from '../components/PlayerTag.tsx';
import { ProfileAbout, SiteIcon } from '../components/ProfileAbout.tsx';
import { QrCode } from '../components/QrCode.tsx';
import { RatingHistoryChart } from '../components/RatingHistoryChart.tsx';
import { Stars } from '../components/Stars.tsx';
import { Checkbox, ColorField, Field, FieldRow, OptionCards, RadioGroup, Select, SettingRow, Slider, SubmitButton, Toggle } from '../components/ui.tsx';
import { icons } from '../icons.ts';
import { prefs, updatePrefs } from '../prefs.ts';
import { useStore } from '../store.ts';
import { ResultBar } from './ExplorerPage.tsx';
import { Records } from './PuzzleRunPage.tsx';

/**
 * Living reference of ligungi's UI: real components rendered with the real styles. Developer-facing, so it is in
 * English and not linked from the menus. Open /design while building a screen and reuse what is here.
 */

const COLORS = [
  ['c-bg-page', 'Page background'],
  ['c-bg-box', 'Boxes and panels'],
  ['c-bg-zebra', 'Alternate rows, hands'],
  ['c-border', 'Borders and dividers'],
  ['c-font', 'Body text'],
  ['c-font-clear', 'Emphasis'],
  ['c-font-dim', 'Secondary text'],
  ['c-font-dimmer', 'Hints, footer'],
  ['c-link', 'Links'],
  ['c-primary', 'Primary actions'],
  ['c-accent', 'Brand accent (shu red)'],
  ['c-brag', 'Leaderboards, ranks'],
  ['c-good', 'Success, online, gains'],
  ['c-bad', 'Danger, losses'],
  ['c-error', 'Errors'],
] as const;

const Section = ({ id, title, note, children }: { id: string; title: string; note?: string; children: ComponentChildren }) => (
  <section id={id} class="ligungi-ds__section">
    <h2>{title}</h2>
    {note && <p class="ligungi-notice">{note}</p>}
    {children}
  </section>
);

const Example = ({ label, children }: { label: string; children: ComponentChildren }) => (
  <div class="ligungi-ds__example">
    <span class="ligungi-ds__label">{label}</span>
    <div class="ligungi-ds__demo">{children}</div>
  </div>
);

const lessonPosition = parseFen('9/9/9/9/9/9/4P4/4S4/9 w - advanced p w');

export const DesignPage = () => {
  const { theme } = useStore(prefs);
  const [mode, setMode] = useState('advanced');
  const [color, setColor] = useState('#e3c389');
  const [minutes, setMinutes] = useState(10);
  const [sliderSeconds, setSliderSeconds] = useState(30);
  const [switched, setSwitched] = useState(true);
  const [checked, setChecked] = useState(true);
  const [choice, setChoice] = useState<'white' | 'random' | 'black'>('random');
  const [level, setLevel] = useState(2);
  const sections = [
    ['principles', 'Principles'],
    ['colors', 'Colors'],
    ['type', 'Typography'],
    ['buttons', 'Buttons'],
    ['forms', 'Forms'],
    ['feedback', 'Feedback'],
    ['pages', 'Page blocks'],
    ['data', 'Data'],
    ['game', 'Game'],
  ];

  return (
    <main class="page-menu ligungi-ds">
      <nav class="page-menu__menu subnav">
        {sections.map(([id, label]) => (
          <a key={id} href={`#${id}`} onClick={(e) => (e.preventDefault(), document.getElementById(id!)?.scrollIntoView({ behavior: 'smooth' }))}>
            {label}
          </a>
        ))}
      </nav>
      <div class="page-menu__content box box-pad">
        <div class="ligungi-ds__top">
          <h1 class="box__top">Design system</h1>
          <RadioGroup
            name="ds-theme"
            value={theme}
            options={(['light', 'dark', 'auto'] as const).map((value) => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))}
            onChange={(value) => updatePrefs({ theme: value })}
          />
        </div>

        <Section id="principles" title="Principles">
          <ul class="ligungi-ds__list">
            <li>Keep the lichess look: lila's markup and SCSS (vendored, never edited) are the base; ligungi only adds what lila lacks, in <code>styles/ligungi.scss</code>.</li>
            <li>Forms use the components in <code>components/ui.tsx</code> (Field, FieldRow, Select, Checkbox, RadioGroup, OptionCards, SubmitButton). Never write raw inputs or selects.</li>
            <li>Colors come from the theme variables below, never hard-coded, so light and dark both work.</li>
            <li>Spacing scale: 0.25, 0.5, 1 and 1.6 rem. Fields are 1.6rem apart on pages and 1.1rem in dialogs.</li>
            <li>One main action per form (SubmitButton, full width). Secondary actions use <code>button-empty</code>.</li>
            <li>Every text a player sees goes through the locale files (ICU messages, English as the source), translated by volunteers.</li>
          </ul>
        </Section>

        <Section id="colors" title="Colors" note="CSS variables from lila's themes, overridden for ligungi's accent. Switch the theme above to compare.">
          <div class="ligungi-ds__swatches">
            {COLORS.map(([name, use]) => (
              <div key={name} class="ligungi-ds__swatch">
                <span style={{ background: `var(--${name})` }} />
                <code>--{name}</code>
                <small>{use}</small>
              </div>
            ))}
          </div>
        </Section>

        <Section id="type" title="Typography">
          <Example label="Page title (h1.box__top)">
            <h1 class="box__top ligungi-ds__inline">Live games</h1>
          </Example>
          <Example label="Section title (h2)">
            <h2 class="ligungi-ds__inline">How the pieces move</h2>
          </Example>
          <Example label="Body">
            <p>Only the top piece of a tower moves, and its tier extends its reach.</p>
          </Example>
          <Example label="Secondary (.ligungi-notice)">
            <p class="ligungi-notice">Preferences are saved in this browser.</p>
          </Example>
          <Example label="Pointer for newcomers (.ligungi-home__newcomer)">
            <p class="ligungi-home__newcomer">
              New to Gungi? Start with <a href="/lessons/pieces">the first lesson</a>, or play <a href="/computer">the computer in Beginner mode</a>.
            </p>
          </Example>
          <Example label="Error (.error)">
            <div class="form3">
              <p class="error">That username is already taken.</p>
            </div>
          </Example>
          <Example label="Link">
            <a href="/learn">Learn the rules</a>
          </Example>
        </Section>

        <Section id="buttons" title="Buttons">
          <Example label="Primary (.button)">
            <button type="button" class="button">Create game</button>
          </Example>
          <Example label="Secondary (.button.button-empty)">
            <button type="button" class="button button-empty">Cancel</button>
          </Example>
          <Example label="Danger (.button.button-red)">
            <button type="button" class="button button-red">Cancel challenge</button>
          </Example>
          <Example label="Large menu (.button.button-metal)">
            <button type="button" class="button button-metal">Play with a friend</button>
          </Example>
          <Example label="Disabled">
            <button type="button" class="button" disabled>
              Rated
            </button>
          </Example>
          <Example label="Icon buttons (.fbt with data-icon)">
            <div class="ligungi-ds__row">
              <button type="button" class="fbt" title="Flip board" data-icon={icons.ChasingArrows} />
              <button type="button" class="fbt" title="Take back" data-icon={icons.Back} />
              <button type="button" class="fbt" title="First" data-icon={icons.JumpFirst} />
              <button type="button" class="fbt" title="Next" data-icon={icons.JumpNext} />
            </div>
          </Example>
        </Section>

        <Section id="forms" title="Forms" note="components/ui.tsx">
          <form class="form3 ligungi-ds__form" onSubmit={(e) => e.preventDefault()}>
            <Field label="Field with select and help" htmlFor="ds-mode" help="Help text sits under the control.">
              <Select
                id="ds-mode"
                value={mode}
                options={[
                  { value: 'intro', label: 'Introductory' },
                  { value: 'advanced', label: 'Advanced' },
                ]}
                onChange={setMode}
              />
            </Field>
            <FieldRow>
              <Field label="FieldRow: left" htmlFor="ds-min">
                <Select id="ds-min" value={minutes} options={[5, 10, 15].map((m) => ({ value: m, label: m }))} onChange={setMinutes} />
              </Field>
              <Field label="FieldRow: right" htmlFor="ds-text">
                <input id="ds-text" class="form-control" placeholder="Text input (.form-control)" />
              </Field>
            </FieldRow>
            <Field
              label={
                <>
                  <SiteIcon site="youtube" /> Prefixed input (.ligungi-prefixed): only the end of an address is typed
                </>
              }
              htmlFor="ds-prefixed"
            >
              <div class="ligungi-prefixed">
                <span class="ligungi-prefixed__prefix" aria-hidden="true">
                  youtube.com/@
                </span>
                <input id="ds-prefixed" class="form-control" value="gon" readOnly />
              </div>
            </Field>
            <Checkbox id="ds-check" checked={checked} onChange={setChecked} label="Checkbox" help="Optional help, aligned with the label." />
            <Checkbox id="ds-check-off" checked={false} onChange={() => {}} label="Disabled checkbox" disabled />
            <Field label="RadioGroup">
              <RadioGroup
                name="ds-color"
                value={choice}
                options={[
                  { value: 'white', label: 'White' },
                  { value: 'random', label: 'Random' },
                  { value: 'black', label: 'Black' },
                ]}
                onChange={setChoice}
              />
            </Field>
            <SubmitButton>SubmitButton</SubmitButton>
          </form>
          <Example label="Settings rows (SettingRow + Toggle, OptionCards for choices), as on the preferences page">
            <div class="form3" style={{ width: '100%' }}>
              <SettingRow title="Toggle setting" help="Simple on or off settings use a switch; the title toggles it too." htmlFor="ds-switch">
                <Toggle id="ds-switch" checked={switched} onChange={setSwitched} label="Toggle setting" />
              </SettingRow>
              <div class="ligungi-setting">
                <OptionCards
                  name="ds-stacked"
                  legend="Choice setting"
                  layout="segmented"
                  value={choice}
                  options={[
                    { value: 'white', label: 'White' },
                    { value: 'random', label: 'Random' },
                    { value: 'black', label: 'Black' },
                  ]}
                  onChange={setChoice}
                  help="A choice among a few options is a segmented OptionCards in a .ligungi-setting row."
                />
              </div>
            </div>
          </Example>
          <Example label="Slider: a value from a list (not a numeric range), label and value on one row; arrow keys step through the list">
            <div class="form3" style={{ display: 'grid', gap: '0.75rem', width: '100%', maxWidth: '30rem' }}>
              <Slider id="ds-slider-minutes" label="Minutes" values={[1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180]} value={minutes} onChange={setMinutes} />
              <Slider id="ds-slider-seconds" label="Seconds per move" values={[10, 20, 30, 60]} value={sliderSeconds} format={(s) => `${s} s`} onChange={setSliderSeconds} />
            </div>
          </Example>
          <Example label="OptionCards: one choice among a few, as cards (layout cards, row or segmented); cards stack on phones">
            <div style={{ display: 'grid', gap: '1.25rem', width: '100%' }}>
              <OptionCards
                name="ds-cards"
                legend="Level"
                value={level}
                options={[1, 2, 3].map((n) => ({ value: n, badge: n, label: ['Random', 'Greedy', 'Careful'][n - 1]!, hint: 'One line of help.' }))}
                onChange={setLevel}
              />
              <OptionCards
                name="ds-row"
                legend="Your colour"
                layout="row"
                value={choice}
                options={(['white', 'random', 'black'] as const).map((value) => ({
                  value,
                  label: value,
                  icon: <span class={`ligungi-choice__disc ligungi-choice__disc--${value}`} aria-hidden="true" />,
                }))}
                onChange={setChoice}
              />
              <OptionCards
                name="ds-segmented"
                legend="Mode"
                layout="segmented"
                value={mode}
                options={['intro', 'beginner', 'intermediate', 'advanced'].map((value) => ({ value, label: value }))}
                onChange={setMode}
              />
            </div>
          </Example>
          <Example label="ColorField, and .ligungi-warnings for things worth fixing that are not errors">
            <div class="ligungi-custom-board">
              <FieldRow>
                <ColorField id="ds-color" label="Board color" value={color} onChange={setColor} />
              </FieldRow>
              <ul class="ligungi-warnings">
                <li>Lines and coordinates are hard to see.</li>
              </ul>
            </div>
          </Example>
          <Example label="Two-step verification (account page): QrCode, a code field, recovery codes">
            <div class="ligungi-two-factor__setup">
              <QrCode text="otpauth://totp/ligungi:Example?secret=JBSWY3DPEHPK3PXP&issuer=ligungi" label="QR code example" />
              <div class="form3">
                <p class="ligungi-two-factor__key">
                  Key: <code>JBSW Y3DP EHPK 3PXP</code>
                </p>
                <Field label="Code from the app" htmlFor="ds-code" help="Monospaced, with one-time-code autocomplete.">
                  <input id="ds-code" class="form-control ligungi-code-input" autoComplete="one-time-code" value="123 456" readOnly />
                </Field>
                <ol class="ligungi-recovery__codes">
                  {['kmpei-7uyqm', 'sfeg3-pead2', 'wwzr3-pw374', '6gdzu-6dydt'].map((code) => (
                    <li key={code}>
                      <code>{code}</code>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Example>
        </Section>

        <Section id="feedback" title="Feedback">
          <Example label="First player mark">
            <span class="ligungi-first">1st</span>
          </Example>
          <Example label="Waiting (.ligungi-waiting, home)">
            <div class="ligungi-waiting">
              <div class="ligungi-waiting__spinner" aria-hidden="true" />
              <h2>Waiting for an opponent</h2>
              <div class="ligungi-waiting__seek">
                <span>Advanced · 10+5 · Casual</span>
                <button type="button" class="button button-empty button-red">
                  Cancel game
                </button>
              </div>
              <p class="ligungi-waiting__hint">Your game is in the lobby and starts as soon as someone accepts it.</p>
            </div>
          </Example>
          <Example label="Connection notice (ConnectionToast, fixed at the bottom): stays while offline, a few seconds when back">
            <div class="ligungi-ds__row">
              <div class="ligungi-toast__box ligungi-toast__box--bad">You are offline. This page stays open and reconnects when the internet is back.</div>
              <div class="ligungi-toast__box ligungi-toast__box--good">Back online.</div>
            </div>
          </Example>
          <Example label="Confirmation (Modal + .ligungi-modal__actions): secondary first, then the action">
            <div>
              <p>It leaves the lobby and nobody else can accept it.</p>
              <p class="ligungi-modal__summary">Advanced · 10+5 · Casual</p>
              <div class="ligungi-modal__actions">
                <button type="button" class="button button-empty">
                  Keep waiting
                </button>
                <button type="button" class="button button-red">
                  Yes, cancel
                </button>
              </div>
            </div>
          </Example>
        </Section>

        <Section id="pages" title="Page blocks" note="The redesigned pages (profile first) are built from these: a ligungi-page main, ligungi-card boxes, segmented tabs and chips.">
          <Example label="Card with avatar (.ligungi-card, .ligungi-avatar)">
            <div class="ligungi-card ligungi-ds__row" style={{ padding: '1rem' }}>
              <span class="ligungi-avatar" aria-hidden="true">
                K
              </span>
              <span class="ligungi-avatar ligungi-avatar--online" aria-hidden="true">
                M
              </span>
              <span>A box on the page background, with the shadow and corners of every card.</span>
            </div>
          </Example>
          <Example label="Tabs (.ligungi-segmented) and chips (.ligungi-chip)">
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <nav class="ligungi-segmented" aria-label="Example tabs">
                <a class="active" href="#pages">
                  All <strong>52</strong>
                </a>
                <a href="#pages">
                  Rated <strong>38</strong>
                </a>
                <a href="#pages">
                  Wins <strong>29</strong>
                </a>
              </nav>
              <nav class="ligungi-chips" aria-label="Example chips">
                <a class="ligungi-chip active" href="#pages">
                  All modes
                </a>
                <a class="ligungi-chip" href="#pages">
                  Advanced
                </a>
              </nav>
            </div>
          </Example>
          <Example label="Results table (.ligungi-search-table): a header row, then one link per row, every other one shaded; on phones the columns fold into two lines (game search)">
            <div class="ligungi-card" style={{ width: '100%', overflow: 'hidden' }}>
              <div class="ligungi-search-table__head" aria-hidden="true">
                <span>Players</span>
                <span>Result</span>
                <span>Mode and pace</span>
                <span class="ligungi-search-table__moves">Moves</span>
                <span class="ligungi-search-table__date">Date</span>
              </div>
              <ul class="ligungi-search-table">
                {[
                  ['Mira (1580) × tenzo (1502)', 'White wins', 'resignation', 'Advanced · 10+5 · Rated', 131],
                  ['kaiq (1577) × Rafa (1490)', 'Draw', 'repetition', 'Beginner · 3 days per move · Casual', 64],
                ].map(([players, result, how, mode, moves]) => (
                  <li key={String(players)}>
                    <a class="ligungi-search-table__row" href="#pages">
                      <span class="ligungi-search-table__players">{players}</span>
                      <span class="ligungi-search-table__result">
                        {result}
                        <small>{how}</small>
                      </span>
                      <span class="ligungi-search-table__mode">{mode}</span>
                      <span class="ligungi-search-table__moves">{moves}</span>
                      <span class="ligungi-search-table__date">Nov 20, 2026</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </Example>
          <Example label="Live badge (.ligungi-live-badge)">
            <span class="ligungi-live-badge">Live</span>
          </Example>
          <Example label="Game row (.ligungi-game-row)">
            <ul class="ligungi-game-list" style={{ padding: 0 }}>
              <li>
                <a class="ligungi-game-row ligungi-game-row--win" href="#pages">
                  <span class="ligungi-game-row__result">Win</span>
                  <span class="ligungi-game-row__main">
                    <span class="ligungi-game-row__opponent">
                      vs Netero <span class="ligungi-game-row__rating">2100</span>
                    </span>
                    <span class="ligungi-game-row__meta">Advanced · 10+5 · Rated · checkmate · 64 moves</span>
                  </span>
                  <span class="ligungi-game-row__diff">+11</span>
                  <span class="ligungi-game-row__date">Nov 13, 2026</span>
                </a>
              </li>
            </ul>
          </Example>
          <Example label="Quick pairing (.ligungi-pools, .ligungi-pool)">
            <div class="ligungi-pools" style={{ maxWidth: '30rem' }}>
              <button type="button" class="ligungi-pool">
                <span class="ligungi-pool__clock">10+5</span>
                <span class="ligungi-pool__kind">Rated</span>
                <span class="ligungi-pool__waiting is-waiting">2 waiting</span>
              </button>
              <button type="button" class="ligungi-pool">
                <span class="ligungi-pool__clock">30+20</span>
                <span class="ligungi-pool__kind">Rated</span>
                <span class="ligungi-pool__waiting">nobody waiting</span>
              </button>
            </div>
          </Example>
          <Example label="Open game row (.ligungi-seek)">
            <ul class="ligungi-card ligungi-seeks">
              <li class="ligungi-seek">
                <span class="ligungi-seek__player">
                  <span class="is is2 color-icon random" />
                  <span class="ligungi-seek__name">Netero</span>
                  <span class="ligungi-seek__rating">2100</span>
                </span>
                <span class="ligungi-seek__time">15+10</span>
                <span class="ligungi-seek__mode">Advanced</span>
                <span class="ligungi-seek__kind">Rated</span>
                <span class="ligungi-seek__meta">Advanced · 15+10 · Rated</span>
                <button type="button" class="button ligungi-button-good ligungi-seek__action">
                  Join
                </button>
              </li>
            </ul>
          </Example>
          <Example label="Game in progress (.ligungi-live-strip)">
            <section class="ligungi-card ligungi-live-strip">
              <span class="ligungi-live-badge">Your game</span>
              <span class="ligungi-live-strip__text">Gon × Killua · Advanced · 10+5</span>
              <a class="button" href="#pages">
                Back to the game
              </a>
            </section>
          </Example>
          <Example label="Ranking rows with medals and the viewer's row (.ligungi-ranking-row)">
            <ol class="ligungi-card ligungi-ranking-list">
              <li class="ligungi-ranking-row">
                <span class="ligungi-ranking-row__rank ligungi-ranking-row__rank--1">1</span>
                <span class="ligungi-ranking-row__player">
                  <a class="user-link online" href="#pages">
                    <i class="line" />
                    Netero
                  </a>
                </span>
                <strong class="ligungi-ranking-row__rating">2100</strong>
                <span class="ligungi-ranking-row__games">40</span>
                <span class="ligungi-ranking-row__record">
                  <span class="ligungi-ranking-row__win">25</span> · 3 · <span class="ligungi-ranking-row__loss">12</span>
                </span>
                <span class="ligungi-ranking-row__meta">40 games · 25 W · 3 D · 12 L</span>
              </li>
              <li class="ligungi-ranking-row ligungi-ranking-row--me">
                <span class="ligungi-ranking-row__rank">27</span>
                <span class="ligungi-ranking-row__player">
                  <a class="user-link offline" href="#pages">
                    <i class="line" />
                    Gon
                  </a>
                  <span class="ligungi-tag">you</span>
                </span>
                <strong class="ligungi-ranking-row__rating">1580</strong>
                <span class="ligungi-ranking-row__games">15</span>
                <span class="ligungi-ranking-row__record">
                  <span class="ligungi-ranking-row__win">9</span> · 2 · <span class="ligungi-ranking-row__loss">4</span>
                </span>
                <span class="ligungi-ranking-row__meta">15 games · 9 W · 2 D · 4 L</span>
              </li>
            </ol>
          </Example>
          <Example label="Pagination (.ligungi-ranking-pages)">
            <nav class="ligungi-ranking-pages" aria-label="Pages" style={{ marginInlineStart: 0 }}>
              <button type="button" class="ligungi-ranking-pages__step" disabled>
                Previous
              </button>
              <button type="button" class="ligungi-ranking-pages__number active" aria-current="page">
                1
              </button>
              <button type="button" class="ligungi-ranking-pages__number">2</button>
              <span class="ligungi-ranking-pages__gap">…</span>
              <button type="button" class="ligungi-ranking-pages__number">9</button>
              <button type="button" class="ligungi-ranking-pages__step">Next</button>
            </nav>
          </Example>
        </Section>

        <Section id="data" title="Data">
          <Example label="Rating history (RatingHistoryChart): one 2px line, a recessive grid, crosshair and tip on hover or touch">
            <RatingHistoryChart
              label="Example rating history"
              points={[1500, 1562, 1541, 1580, 1574, 1603, 1590, 1622].map((rating, i, all) => ({
                at: Date.UTC(2026, 9, 1 + i * 4),
                rating,
                change: i ? rating - all[i - 1]! : rating - 1500,
                gameId: `example${i}`,
              }))}
            />
          </Example>
          <Example label="Players (PlayerTag)">
            <div class="ligungi-ds__row">
              <PlayerTag player={{ name: 'Netero', user: { id: 'x', name: 'Netero' }, rating: 2100, ratingDiff: 8 }} />
              <PlayerTag player={{ name: 'Zeno', user: { id: 'y', name: 'Zeno' }, rating: 1950, ratingDiff: -8, provisional: true }} />
              <PlayerTag player={{ name: 'Anonymous', user: null, rating: null, ratingDiff: null }} />
            </div>
          </Example>
          <Example label="Presence (.user-link)">
            <div class="ligungi-ds__row">
              <a class="user-link online" href="#data">
                <i class="line" />
                Online
              </a>
              <a class="user-link offline" href="#data">
                <i class="line" />
                Offline
              </a>
            </div>
          </Example>
          <Example label="Flags beside names (Flag, .ligungi-flag)">
            <div class="ligungi-ds__row">
              <span>
                Gon <Flag country="br" />
              </span>
              <span>
                Killua <Flag country="jp" />
              </span>
              <span>
                Kite <Flag country="pt" />
              </span>
            </div>
          </Example>
          <Example label="Profile about: bio, social networks and profiles on other game sites (ProfileAbout)">
            <ProfileAbout details={{ bio: 'Gungi every day.\nAdvanced mode, slow games.', country: 'br', links: { youtube: 'gon', twitch: 'gon_plays', lichess: 'Gon', lishogi: 'Gon' } }} />
          </Example>
          <Example label="Tabs (.number-menu--tabs)">
            <div class="number-menu number-menu--tabs">
              <a class="nm-item active" href="#data">
                <strong>26</strong> games
              </a>
              <a class="nm-item" href="#data">
                <strong>16</strong> wins
              </a>
              <a class="nm-item" href="#data">
                <strong>5</strong> losses
              </a>
            </div>
          </Example>
          <Example label="Table (.slist)">
            <table class="slist slist-pad">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>Netero</td>
                  <td>2100</td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>Zeno</td>
                  <td>1950</td>
                </tr>
              </tbody>
            </table>
          </Example>
        </Section>

        <Section id="game" title="Game">
          <Example label="Pieces (.gg-mini-piece)">
            <div class="ligungi-ds__row gg-palette">
              <span class="gg-mini-piece white">
                <span>帥</span>
              </span>
              <span class="gg-mini-piece black">
                <span>帥</span>
              </span>
            </div>
          </Example>
          <Example label="Piece looks: the page root's gg-shape-koma, gg-pieces-<palette> and ligungi-kanji-<font> classes restyle every piece; here set locally">
            <div class="ligungi-ds__row">
              <span class="gg-palette gg-pieces-lacquer ligungi-kanji-gothic ligungi-ds__row">
                <span class="gg-mini-piece white">
                  <span>帥</span>
                </span>
                <span class="gg-mini-piece black">
                  <span>帥</span>
                </span>
              </span>
              <span class="gg-shape-koma gg-palette gg-pieces-wood ligungi-kanji-brush ligungi-ds__row">
                <span class="gg-mini-piece white">
                  <span>帥</span>
                </span>
                <span class="gg-mini-piece black flipped">
                  <span>帥</span>
                </span>
              </span>
              <span class="ligungi-font-sample ligungi-font-sample--pop">帥</span>
              <span class="ligungi-swatch">
                <i style={{ background: '#d9a27c' }} />
                <i style={{ background: '#2b211c' }} />
              </span>
            </div>
          </Example>
          <Example label="Static board (MiniBoard)">
            <div class="ligungi-ds__board">
              <MiniBoard position={initialPosition('intro')} />
            </div>
          </Example>
          <Example label="Lesson stars (Stars, .ligungi-stars) and a stage card of the lessons map (.ligungi-lesson-stage)">
            <div class="ligungi-ds__row">
              <Stars filled={3} label="3 of 3" />
              <Stars filled={2} label="2 of 3" />
              <Stars filled={0} label="0 of 3" />
            </div>
            <a class="ligungi-card ligungi-lesson-stage" href="#game" style={{ maxWidth: '18rem', marginTop: '1rem' }}>
              <span class="ligungi-lesson-stage__number">Stage 2</span>
              <strong class="ligungi-lesson-stage__title">Towers</strong>
              <span class="ligungi-lesson-stage__intro">A piece can climb onto another instead of going to an empty square.</span>
              <span class="ligungi-lesson-stage__dots" aria-hidden="true">
                <i class="is-3" />
                <i class="is-2" />
                <i class="is-0" />
              </span>
            </a>
          </Example>
          <Example label="Round timer of the coordinate trainer (.ligungi-coords__time)">
            <div class="ligungi-coords__time" style={{ maxWidth: '16rem' }}>
              <span style={{ width: '60%' }} />
            </div>
          </Example>
          <Example label="Practice position card, with the done mark (.ligungi-practice__position)">
            <a class="ligungi-card ligungi-practice__position" href="#game" style={{ maxWidth: '14rem' }}>
              <MiniBoard position={lessonPosition} />
              <strong>General and two Samurai</strong>
              <span>Mate within 20 moves</span>
              <span class="ligungi-tag ligungi-practice__done" data-icon={icons.Checkmark}>
                Done in 12 moves
              </span>
            </a>
          </Example>
          <Example label="Puzzle rating change (.ligungi-puzzle__change) and a share bar of the puzzle dashboard (.ligungi-puzzle-dashboard__bar)">
            <p class="ligungi-puzzle__change is-up">Puzzle rating: 1557 (+57)</p>
            <p class="ligungi-puzzle__change is-down">Puzzle rating: 1490 (-12)</p>
            <span class="ligungi-puzzle-dashboard__bar" style={{ '--rate': '64%', maxWidth: '16rem' }}>
              64%
            </span>
          </Example>
          <Example label="Puzzle Storm card: clock with a time bonus, score, combo toward the next bonus and records (.ligungi-run)">
            <section class="ligungi-card ligungi-game-info ligungi-run" style={{ maxWidth: '18rem' }}>
              <div class="ligungi-run__clock">
                <span class="ligungi-run__time">2:41</span>
                <span class="ligungi-run__flash is-good" style={{ animation: 'none' }}>
                  +5s
                </span>
                <span class="ligungi-run__bar">
                  <span style={{ width: '89%' }} />
                </span>
              </div>
              <p class="ligungi-run__score">
                <strong>9</strong>
                <span>Solved</span>
              </p>
              <div class="ligungi-run__combo">
                <span>
                  Combo <strong>14</strong>
                </span>
                <span class="ligungi-run__bar is-combo">
                  <span style={{ width: '25%' }} />
                </span>
              </div>
              <Records records={{ today: 9, week: 14, ever: 21 }} />
            </section>
          </Example>
          <Example label="Results of the draft explorer: White wins, draws and Black wins (.ligungi-explorer__bar)">
            <div style={{ maxWidth: '16rem' }}>
              <ResultBar stats={{ games: 20, white: 9, draws: 3, black: 8, rating: 1600 }} />
            </div>
          </Example>
          <Example label="Goal stars on the board (the board's targets option), on empty squares and above a piece">
            <div class="ligungi-ds__board">
              <BoardView position={lessonPosition} orientation="white" targets={[parseSquare('e5')!, parseSquare('e3')!]} />
            </div>
          </Example>
          <Example label="Home cards: the leaders, one row per mode (.ligungi-home__leaders), and a signed-in player's training links (.ligungi-home__training)">
            <section class="ligungi-card ligungi-home__leaders" style={{ maxWidth: '34rem' }}>
              <div class="ligungi-home__card-head">
                <h2>Top players</h2>
                <a href="#game">Leaderboard</a>
              </div>
              <ul>
                {[
                  ['Advanced', 'shogun42', 1712, true],
                  ['Advanced', 'torre_alta', 1688, false],
                  ['Beginner', 'kanji_fan', 1602, true],
                  ['Beginner', 'ronin7', 1580, false],
                ].map(([mode, name, rating, online]) => (
                  <li key={String(name)}>
                    <span class="ligungi-home__leader">
                      <a class="ligungi-home__leader-mode" href="#game">
                        {mode}
                      </a>
                      <a class={`user-link${online ? ' online' : ''}`} href="#game">
                        <i class="line" />
                        {name}
                      </a>
                    </span>
                    <strong>{rating}</strong>
                  </li>
                ))}
              </ul>
            </section>
            <section class="ligungi-card ligungi-home__training" style={{ maxWidth: '18rem' }}>
              <h2>Train</h2>
              <ul>
                {[
                  ['Puzzle rating', '1532'],
                  ['Puzzle Storm, best', '18'],
                  ['Puzzle Streak, best', '9'],
                  ['Lessons', '6 of 8 stages'],
                ].map(([label, value]) => (
                  <li key={label}>
                    <a href="#game">
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </Example>
          <Example label="Rating trend beside a rating (components/RatingTrend.tsx): the change over the last 7 days, nothing when it did not move">
            <span style={{ display: 'flex', gap: '1.5rem' }}>
              <span>
                <strong>1712</strong> <RatingTrend value={24} />
              </span>
              <span>
                <strong>1688</strong> <RatingTrend value={-9} />
              </span>
            </span>
          </Example>
          <Example label="Head to head between two players (components/Crosstable.tsx): score, draws and the latest results from the first player's side">
            <div style={{ maxWidth: '20rem', width: '100%' }}>
              <CrosstableView
                data={{
                  users: [
                    { id: 'a', name: 'shogun42' },
                    { id: 'b', name: 'torre_alta' },
                  ],
                  wins: [5, 3],
                  draws: 1,
                  recent: [
                    { id: 'g1', winner: 0 },
                    { id: 'g2', winner: 1 },
                    { id: 'g3', winner: null },
                    { id: 'g4', winner: 0 },
                    { id: 'g5', winner: 0 },
                  ],
                }}
                allHref="#game"
              />
            </div>
          </Example>
          <Example label="TV channel list, beside the watched game (.ligungi-tv-channels)">
            <nav class="ligungi-card ligungi-tv-channels" aria-label="Channels" style={{ maxWidth: '16rem' }}>
              <a class="ligungi-tv-channel active" href="#game" aria-current="page">
                <strong>Top rated</strong>
                <span>Netero × Meruem</span>
              </a>
              <a class="ligungi-tv-channel" href="#game">
                <strong>Advanced</strong>
                <span>Gon × Killua</span>
              </a>
              <a class="ligungi-tv-channel" href="#game">
                <strong>Introductory</strong>
                <span>No games right now</span>
              </a>
            </nav>
          </Example>
          <Example label="Study card in the list (.ligungi-studies__card): text only, never a board">
            <ul class="ligungi-studies__list" style={{ maxWidth: '20rem', width: '100%' }}>
              <li>
                <a class="ligungi-studies__card" href="#game">
                  <strong class="ligungi-studies__name">Draft: protecting the Marshal</strong>
                  <span class="ligungi-studies__description">Four ways to build the Marshal's defense in the draft.</span>
                  <span class="ligungi-studies__meta">
                    <span>4 chapters</span>
                    <span>by marechal_br</span>
                    <span>2 h ago</span>
                  </span>
                </a>
              </li>
            </ul>
          </Example>
          <Example label="Drawings on the board (board shapes), the limit message over the board (.ligungi-study__toast) and the study's drawing tools (.ligungi-study__draw): up to 2 arrows and 4 painted squares per move">
            <div class="ligungi-study" style={{ display: 'grid', gap: '0.75rem', width: '100%', maxWidth: '22rem' }}>
              <div style={{ width: '100%', position: 'relative' }}>
                <BoardView
                  position={initialPosition('intro')}
                  orientation="white"
                  shapes={[
                    { kind: 'arrow', from: parseSquare('e3')!, to: parseSquare('e5')!, color: 'green' },
                    { kind: 'square', square: parseSquare('e5')!, color: 'red' },
                    { kind: 'square', square: parseSquare('d5')!, color: 'blue' },
                  ]}
                />
                <p class="ligungi-study__toast" role="status">
                  Each move has up to 2 arrows and 4 painted squares. Erase one to draw another.
                </p>
              </div>
              <div class="ligungi-study__draw" role="group" aria-label="Draw">
                <span class="ligungi-study__draw-label">Draw</span>
                {(['green', 'red', 'blue', 'orange'] as const).map((brush, i) => (
                  <button key={brush} type="button" class={`ligungi-study__swatch gg-brush-${brush}`} aria-pressed={i === 0} aria-label={brush} title={brush} />
                ))}
                <span class="ligungi-study__count">Arrows 1 of 2 · Squares 2 of 4</span>
              </div>
              <p class="ligungi-study__comment">A comment on the current move, as readers see it under the board.</p>
            </div>
          </Example>
          <Example label="Tower on tap, on a phone (the towerTap preference): the strip under the board (TowerStrip, .ligungi-tower-strip), empty and with a tower. The balloon choice is the board's own floating panel (inspector and inspectSelection)">
            <div style={{ display: 'grid', gap: '0.75rem', width: '100%', maxWidth: '24rem' }}>
              <TowerStrip position={initialPosition('intro')} square={null} />
              <TowerStrip
                position={parseFen('4m4/9/9/9/4(Psp)4/9/9/9/4M4 w - advanced p w')}
                square={parseSquare('e5')!}
              />
            </div>
          </Example>
          <Example label="Activity (.ligungi-activity, one day of the profile's last 30) and the feed of followed players (FeedList, home and friends page)">
            <div style={{ display: 'grid', gap: '1rem', width: '100%', maxWidth: '34rem' }}>
              <section class="ligungi-card ligungi-activity">
                <header class="ligungi-activity__head">
                  <h2>Activity</h2>
                  <span class="ligungi-activity__intro">The last 30 days.</span>
                </header>
                <ol class="ligungi-activity__days">
                  <li class="ligungi-activity__day">
                    <h3>Nov 17, 2026</h3>
                    <ul class="ligungi-activity__items">
                      <li class="ligungi-activity__item is-games">
                        3 Advanced games: 2 wins, 1 loss<span class="ligungi-activity__diff is-up"> +14</span>
                      </li>
                      <li class="ligungi-activity__item is-study">
                        Created the study <a href="/study">Draft: protecting the Marshal</a>
                      </li>
                      <li class="ligungi-activity__item is-training">Solved 7 of 9 puzzles</li>
                    </ul>
                  </li>
                </ol>
              </section>
              <section class="ligungi-card ligungi-home__feed">
                <div class="ligungi-home__card-head">
                  <h2>People you follow</h2>
                  <a href="/friends">See all</a>
                </div>
                <FeedList
                  items={[
                    {
                      user: { id: 'a', name: 'marechal_br' },
                      event: {
                        kind: 'game',
                        at: Date.now() - 600_000,
                        game: { id: 'abcd1234', mode: 'advanced', rated: true, color: 'white', result: 'win', reason: 'mate', ratingDiff: 9, opponent: { name: 'kanji_fan', user: null } },
                      },
                    },
                    { user: { id: 'b', name: 'torre_alta' }, event: { kind: 'study', at: Date.now() - 7_200_000, study: { id: 'efgh5678', title: 'Endgames with the Fortress' } } },
                  ]}
                />
              </section>
            </div>
          </Example>
          <Example label="Screen reader mode (BlindPanel, .ligungi-blind): the game as text under the board, with the command field and the live log of announcements (role=log). Type p, c 4-7 or 6-6 samurai here; this sample has no moves to play">
            <div style={{ width: '100%', maxWidth: '34rem' }}>
              <BlindPanel
                position={initialPosition('beginner')}
                legal={[]}
                positions={[initialPosition('beginner')]}
                moves={[]}
                live
                names={{ white: 'marechal_br', black: 'kanji_fan' }}
                autoFocus={false}
              />
            </div>
          </Example>
        </Section>
      </div>
    </main>
  );
};
