import { LESSON_STARS_MAX } from '@ligungi/content';

/** Lesson stars drawn with CSS, filled up to `filled`; `label` says the score to screen readers and on hover. */
export const Stars = ({ filled, label }: { filled: number; label: string }) => (
  <span class="ligungi-stars" role="img" aria-label={label} title={label}>
    {Array.from({ length: LESSON_STARS_MAX }, (_, i) => (
      <i key={i} class={i < filled ? 'is-filled' : ''} />
    ))}
  </span>
);
