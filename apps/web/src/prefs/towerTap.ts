import { prefs } from './prefs.ts';
import { useStore } from '../core/store.ts';
import { useMediaQuery } from '../core/useMediaQuery.ts';

/** lila's one column layout (`mq-is-col1`): a phone held upright, where the side panel ends up below the game. */
const ONE_COLUMN = '(max-width: 799.98px) and (orientation: portrait)';

/**
 * How a tapped tower is shown on a phone, from the preference: a balloon next to the square or a strip under the
 * board. On wider screens the side panel shows the hovered tower, so neither is used. With the pieces hidden for
 * training, neither shows what the pieces are (unless peeking is allowed), as the side panel does.
 */
export const useTowerTap = (training: boolean): { balloon: boolean; strip: boolean } => {
  const { towerTap, hidePieces, peekPieces } = useStore(prefs);
  const phone = useMediaQuery(ONE_COLUMN);
  const allowed = phone && !(training && hidePieces && !peekPieces);
  return { balloon: allowed && towerTap === 'balloon', strip: allowed && towerTap === 'strip' };
};
