/** Glicko-2 (Glickman, 2012) for a single game per rating period, as lichess does. */
export interface Rating {
  readonly rating: number;
  readonly deviation: number;
  readonly volatility: number;
}

export const DEFAULT_RATING: Rating = { rating: 1500, deviation: 350, volatility: 0.06 };
export const PROVISIONAL_DEVIATION = 110;

const SCALE = 173.7178;
const TAU = 0.5;
const EPSILON = 0.000001;
const MIN_DEVIATION = 45;
const MAX_DEVIATION = 350;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));

export const updateRating = (player: Rating, opponent: Rating, score: 0 | 0.5 | 1): Rating => {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.deviation / SCALE;
  const muJ = (opponent.rating - 1500) / SCALE;
  const phiJ = opponent.deviation / SCALE;
  const gJ = g(phiJ);
  const expected = 1 / (1 + Math.exp(-gJ * (mu - muJ)));
  const v = 1 / (gJ * gJ * expected * (1 - expected));
  const delta = v * gJ * (score - expected);

  const a = Math.log(player.volatility ** 2);
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (TAU * TAU);
  };
  let lower = a;
  let upper: number;
  if (delta * delta > phi * phi + v) {
    upper = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    upper = a - k * TAU;
  }
  let fLower = f(lower);
  let fUpper = f(upper);
  while (Math.abs(upper - lower) > EPSILON) {
    const c = lower + ((lower - upper) * fLower) / (fUpper - fLower);
    const fC = f(c);
    if (fC * fUpper <= 0) {
      lower = upper;
      fLower = fUpper;
    } else {
      fLower /= 2;
    }
    upper = c;
    fUpper = fC;
  }
  const volatility = Math.exp(lower / 2);
  const phiStar = Math.sqrt(phi * phi + volatility * volatility);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * gJ * (score - expected);
  return {
    rating: muNew * SCALE + 1500,
    deviation: Math.min(MAX_DEVIATION, Math.max(MIN_DEVIATION, phiNew * SCALE)),
    volatility,
  };
};
