import { Section } from './parts.tsx';

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

export const ColorsSection = () => (
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
);
