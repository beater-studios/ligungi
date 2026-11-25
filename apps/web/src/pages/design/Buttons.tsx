import { icons } from '../../icons.ts';
import { Example, Section } from './parts.tsx';

export const ButtonsSection = () => (
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
    <Example label="Icon and label (data-icon on .button): the space between them comes by itself, no class needed">
      <div class="ligungi-ds__row">
        <button type="button" class="button button-empty" data-icon={icons.Download}>
          Download
        </button>
        <button type="button" class="button" data-icon={icons.Checkmark}>
          Confirm
        </button>
      </div>
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
);
