/**
 * ProbabilityController — converts a uniform [0,1) random number into a SymbolId
 * using the centralized probability table from paytable.ts.
 *
 * Outcome is ALWAYS pre-decided from a seeded RNG value before animation starts.
 */
import { SYMBOLS, type SymbolId } from '../math/paytable';

/** Pre-computed cumulative thresholds for O(n) lookup */
const CUMULATIVE: { id: SymbolId; threshold: number }[] = [];

let cumsum = 0;
for (const sym of SYMBOLS) {
  cumsum += sym.probability;
  CUMULATIVE.push({ id: sym.id, threshold: cumsum });
}

export class ProbabilityController {
  /**
   * Given a uniform float in [0, 1), return the chosen SymbolId.
   * The roll is the ONLY thing that decides the outcome.
   */
  resolve(roll: number): SymbolId {
    for (const entry of CUMULATIVE) {
      if (roll < entry.threshold) return entry.id;
    }
    // Floating-point safety: return last symbol
    return CUMULATIVE[CUMULATIVE.length - 1].id;
  }
}
