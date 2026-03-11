/**
 * Central configuration for all probabilities and payouts.
 * Change numbers here only – never hardcode elsewhere.
 */

export type SymbolId = 'Clover' | 'ForgetMeNot' | 'Rose' | 'GoldenSeed' | 'Tumbleweed';

export interface SymbolConfig {
  id: SymbolId;
  probability: number;
}

/** Symbol probabilities must sum to 1.0 */
export const SYMBOLS: SymbolConfig[] = [
  { id: 'Clover',      probability: 0.051  },
  { id: 'ForgetMeNot', probability: 0.082  },
  { id: 'Rose',        probability: 0.1435 },
  { id: 'GoldenSeed',  probability: 0.01   },
  { id: 'Tumbleweed',  probability: 0.7135 },
];

// Sanity check (dev only)
const probabilitySum = SYMBOLS.reduce((s, sym) => s + sym.probability, 0);
if (Math.abs(probabilitySum - 1.0) > 1e-9) {
  console.warn(`[Paytable] Symbol probabilities sum to ${probabilitySum}, expected 1.0`);
}

/** Ladder pay per level (index 0 = level 0 = no payout, index 1 = level 1, etc.) */
export const CLOVER_PAY: readonly number[]      = [0, 10, 40, 100, 200, 350];
export const FORGET_ME_NOT_PAY: readonly number[] = [0,  3,  8,  15,  30,  60];
export const ROSE_PAY: readonly number[]          = [0,  1,  2,   4,   7,  10];

/** Bonus awarded when ALL three ladders reach level 5 simultaneously. */
export const FLOWER_BONUS = 500;

/** Maximum ladder level */
export const MAX_LEVEL = 5;

/**
 * Collect is only enabled when collectValue >= COLLECT_MULTIPLIER * currentBet.
 * This is the primary RTP-control lever.
 */
export const COLLECT_MULTIPLIER = 2;

// TODO: Future "bonus-visible rebalance profile" hook:
// When FLOWER_BONUS is too rare under this profile, swap out SYMBOLS above
// (e.g. raise GoldenSeed to 0.05 and lower Tumbleweed accordingly).
// Keep FLOWER_BONUS = 500 but reduce individual ladder pays to compensate.
// All other game logic stays identical.

/**
 * Compute current collect value from ladder levels (scaled by bet).
 * Returns 0 if no ladder has any progress.
 */
export function computeCollectValue(
  cloverLevel: number,
  forgetLevel: number,
  roseLevel: number,
  bet: number,
): number {
  const flowerBonus =
    cloverLevel === MAX_LEVEL && forgetLevel === MAX_LEVEL && roseLevel === MAX_LEVEL
      ? FLOWER_BONUS
      : 0;
  return (
    CLOVER_PAY[cloverLevel] +
    FORGET_ME_NOT_PAY[forgetLevel] +
    ROSE_PAY[roseLevel] +
    flowerBonus
  ) * bet;
}

/** Whether the player is currently allowed to collect. */
export function canCollect(collectValue: number, bet: number): boolean {
  return collectValue >= COLLECT_MULTIPLIER * bet;
}
