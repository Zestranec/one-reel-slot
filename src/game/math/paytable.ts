/**
 * Central configuration for all probabilities and payouts.
 * Change numbers here only – never hardcode elsewhere.
 *
 * Design goals:
 *  - Tumbleweed threatening but not dominant
 *  - GoldenSeed meaningfully present
 *  - Flower Bonus rare but reachable in large simulations
 *  - Collect threshold creates push-your-luck tension
 *  - RTP ≈ 97.5%
 */

export type SymbolId = 'Clover' | 'ForgetMeNot' | 'Rose' | 'GoldenSeed' | 'Tumbleweed';

export interface SymbolConfig {
  id: SymbolId;
  probability: number;
}

/** Symbol probabilities must sum to 1.0 */
export const SYMBOLS: SymbolConfig[] = [
  { id: 'Clover',      probability: 0.121 },
  { id: 'ForgetMeNot', probability: 0.160 },
  { id: 'Rose',        probability: 0.229 },
  { id: 'GoldenSeed',  probability: 0.080 },
  { id: 'Tumbleweed',  probability: 0.410 },
];

// Sanity check (dev only)
const probabilitySum = SYMBOLS.reduce((s, sym) => s + sym.probability, 0);
if (Math.abs(probabilitySum - 1.0) > 1e-9) {
  console.warn(`[Paytable] Symbol probabilities sum to ${probabilitySum}, expected 1.0`);
}

/** Ladder pay per level (index 0 = level 0 = no payout, index 1 = level 1, etc.) */
export const CLOVER_PAY: readonly number[]        = [0,  3,  9, 26,  72, 210];
export const FORGET_ME_NOT_PAY: readonly number[] = [0,  1,  4, 10,  24,  58];
export const ROSE_PAY: readonly number[]          = [0,  1,  2,  4,   7,  12];

/** Bonus awarded when ALL three ladders reach level 5 simultaneously. */
export const FLOWER_BONUS = 415;

/** Maximum ladder level */
export const MAX_LEVEL = 5;

/**
 * Collect is only enabled when collectValue >= COLLECT_MULTIPLIER * currentBet.
 * Higher value = more tension, longer average rounds, higher peak payouts.
 */
export const COLLECT_MULTIPLIER = 5;

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
