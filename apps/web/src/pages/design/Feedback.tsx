import { Example, Section } from './parts.tsx';

export const FeedbackSection = () => (
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
);
