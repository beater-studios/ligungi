import { initialPosition } from '@ligungi/engine';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { PlayerTag } from '../components/PlayerTag.tsx';
import { Checkbox, Field, FieldRow, RadioGroup, Select, SettingRow, SubmitButton, Toggle } from '../components/ui.tsx';
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
  const sections = [
    ['principles', 'Principles'],
    ['colors', 'Colors'],
    ['type', 'Typography'],
    ['buttons', 'Buttons'],
    ['forms', 'Forms'],
    ['feedback', 'Feedback'],
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
            <li>Forms use the components in <code>components/ui.tsx</code> (Field, FieldRow, Select, Checkbox, RadioGroup, SubmitButton). Never write raw inputs or selects.</li>
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
        </Section>

        <Section id="feedback" title="Feedback">
          <Example label="Turn badge">
            <span class="ligungi-turn-badge">Your turn</span>
          </Example>
          <Example label="First player mark">
            <span class="ligungi-first">先</span>
          </Example>
          <Example label="Rank">
            <span class="ligungi-rank">#3 on the leaderboard</span>
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
            <div class="ligungi-ds__row">
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
