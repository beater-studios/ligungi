import { Example, Section } from './parts.tsx';

export const TypographySection = () => (
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
);
