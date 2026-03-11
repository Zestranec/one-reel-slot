/**
 * OutcomeController — owns the round state and applies symbol outcomes.
 *
 * Rules:
 * - Clover      → cloverLevel  += 1 (cap 5)
 * - ForgetMeNot → forgetLevel  += 1 (cap 5)
 * - Rose        → roseLevel    += 1 (cap 5)
 * - GoldenSeed  → ALL ladders  += 1 (cap each at 5)
 * - Tumbleweed  → ALL ladders  = 0
 */
import { type SymbolId, MAX_LEVEL, computeCollectValue, canCollect } from '../math/paytable';
import { RNG, randomSeed } from '../utils/RNG';
import { ProbabilityController } from './ProbabilityController';

export interface RoundState {
  cloverLevel: number;
  forgetLevel: number;
  roseLevel: number;
  currentCollectValue: number;
  currentBet: number;
  currentRoundSeed: number;
  spinsThisRound: number;
  collectEnabled: boolean;
  flowerBonusActive: boolean;
}

export class OutcomeController {
  private rng: RNG;
  private pc = new ProbabilityController();
  private state: RoundState;

  constructor(initialBet = 1) {
    const seed = randomSeed();
    this.rng = new RNG(seed);
    this.state = this.freshState(seed, initialBet);
  }

  private freshState(seed: number, bet: number): RoundState {
    return {
      cloverLevel: 0,
      forgetLevel: 0,
      roseLevel: 0,
      currentCollectValue: 0,
      currentBet: bet,
      currentRoundSeed: seed,
      spinsThisRound: 0,
      collectEnabled: false,
      flowerBonusActive: false,
    };
  }

  getState(): Readonly<RoundState> {
    return this.state;
  }

  /**
   * Pre-decide the next spin outcome.
   * Returns the SymbolId BEFORE any animation begins.
   */
  resolveNextSpin(): SymbolId {
    const roll = this.rng.next();
    return this.pc.resolve(roll);
  }

  /**
   * Apply a resolved symbol to the current round state.
   * Called after resolveNextSpin(), still before animation.
   */
  applySymbol(symbol: SymbolId): void {
    const s = this.state;
    s.spinsThisRound += 1;

    switch (symbol) {
      case 'Clover':
        s.cloverLevel = Math.min(s.cloverLevel + 1, MAX_LEVEL);
        break;
      case 'ForgetMeNot':
        s.forgetLevel = Math.min(s.forgetLevel + 1, MAX_LEVEL);
        break;
      case 'Rose':
        s.roseLevel = Math.min(s.roseLevel + 1, MAX_LEVEL);
        break;
      case 'GoldenSeed':
        s.cloverLevel = Math.min(s.cloverLevel + 1, MAX_LEVEL);
        s.forgetLevel = Math.min(s.forgetLevel + 1, MAX_LEVEL);
        s.roseLevel   = Math.min(s.roseLevel   + 1, MAX_LEVEL);
        break;
      case 'Tumbleweed':
        s.cloverLevel = 0;
        s.forgetLevel = 0;
        s.roseLevel   = 0;
        break;
    }

    s.currentCollectValue = computeCollectValue(
      s.cloverLevel, s.forgetLevel, s.roseLevel, s.currentBet
    );
    s.collectEnabled = canCollect(s.currentCollectValue, s.currentBet);
    s.flowerBonusActive =
      s.cloverLevel === MAX_LEVEL &&
      s.forgetLevel === MAX_LEVEL &&
      s.roseLevel   === MAX_LEVEL;
  }

  /**
   * Collect: return payout, reset ladders, start fresh round with same bet.
   * Returns the paid-out amount.
   */
  collect(): number {
    const payout = this.state.currentCollectValue;
    const bet = this.state.currentBet;
    const newSeed = this.rng.getState(); // continue from current RNG position
    this.state = this.freshState(newSeed, bet);
    return payout;
  }

  /** Reset after Tumbleweed wipe (ladders already zeroed by applySymbol) */
  resetAfterWipe(): void {
    // Ladder levels were already set to 0 by applySymbol('Tumbleweed').
    // Just refresh derived fields.
    const s = this.state;
    s.currentCollectValue = 0;
    s.collectEnabled = false;
    s.flowerBonusActive = false;
  }

  setBet(bet: number): void {
    this.state.currentBet = bet;
    this.state.currentCollectValue = computeCollectValue(
      this.state.cloverLevel, this.state.forgetLevel, this.state.roseLevel, bet
    );
    this.state.collectEnabled = canCollect(this.state.currentCollectValue, bet);
  }
}
