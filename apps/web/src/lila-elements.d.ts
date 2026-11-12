import 'preact';

/**
 * Custom tag names used by lila's round and analysis styles (round/css/_constants.scss).
 * The vendored CSS targets these tags, so the markup has to use them too.
 */
declare module 'preact' {
  namespace JSX {
    interface IntrinsicElements {
      i5d: HTMLAttributes<HTMLElement>;
      bo3: HTMLAttributes<HTMLElement>;
      app: HTMLAttributes<HTMLElement>;
      z7yx: HTMLAttributes<HTMLElement>;
      qzm: HTMLAttributes<HTMLElement>;
      name: HTMLAttributes<HTMLElement>;
      rating: HTMLAttributes<HTMLElement>;
      signal: HTMLAttributes<HTMLElement>;
      line: HTMLAttributes<HTMLElement>;
      move: HTMLAttributes<HTMLElement>;
      index: HTMLAttributes<HTMLElement>;
      group: HTMLAttributes<HTMLElement>;
    }
  }
}
