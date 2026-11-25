import { Section } from './parts.tsx';

export const PrinciplesSection = () => (
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
);
