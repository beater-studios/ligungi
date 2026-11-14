import { initialPosition } from '@ligungi/engine';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { PlayerTag } from '../components/PlayerTag.tsx';
import { Checkbox, Field, FieldRow, OptionCards, RadioGroup, Select, SettingRow, SubmitButton, Toggle } from '../components/ui.tsx';
import { icons } from '../icons.ts';
import { prefs, updatePrefs } from '../prefs.ts';
import { useStore } from '../store.ts';

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

export const DesignPage = () => {
  const { theme } = useStore(prefs);
  const [mode, setMode] = useState('advanced');
  const [minutes, setMinutes] = useState(10);
  const [switched, setSwitched] = useState(true);
  const [checked, setChecked] = useState(true);
  const [choice, setChoice] = useState<'white' | 'random' | 'black'>('random');
  const [strength, setStrength] = useState(2);
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
            <li>Every text a player sees goes through the i18n dictionaries, in Portuguese, English and Spanish.</li>
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
          <Example label="Settings rows (SettingRow + Toggle), as on the preferences page">
            <div class="form3" style={{ width: '100%' }}>
              <SettingRow title="Toggle setting" help="Simple on or off settings use a switch; the title toggles it too." htmlFor="ds-switch">
                <Toggle id="ds-switch" checked={switched} onChange={setSwitched} label="Toggle setting" />
              </SettingRow>
              <SettingRow title="Stacked setting" help="Wide controls, such as option groups, go under the text." stacked>
                <RadioGroup
                  name="ds-stacked"
                  value={choice}
                  options={[
                    { value: 'white', label: 'White' },
                    { value: 'random', label: 'Random' },
                    { value: 'black', label: 'Black' },
                  ]}
                  onChange={setChoice}
                />
              </SettingRow>
            </div>
          </Example>
          <Example label="OptionCards: one choice among a few, as cards (layout cards, row or segmented); cards stack on phones">
            <div style={{ display: 'grid', gap: '1.25rem', width: '100%' }}>
              <OptionCards
                name="ds-cards"
                legend="Strength"
                value={strength}
                options={[1, 2, 3].map((n) => ({ value: n, badge: n, label: ['Random', 'Greedy', 'Careful'][n - 1]!, hint: 'One line of help.' }))}
                onChange={setStrength}
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
          <Example label="Static board (MiniBoard)">
            <div class="ligungi-ds__board">
              <MiniBoard position={initialPosition('intro')} />
            </div>
          </Example>
        </Section>
      </div>
    </main>
  );
};
