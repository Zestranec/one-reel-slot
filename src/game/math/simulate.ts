/**
 * Simulation engine for RTP validation.
 * Run: npx tsx src/game/math/simulate.ts
 *
 * Strategy modeled: spin until Tumbleweed OR collect is available, then collect.
 * (Optimal strategy: collect as soon as enabled.)
 */
import { MAX_LEVEL, type SymbolId } from './paytable';
import { RNG, randomSeed } from '../utils/RNG';
import { ProbabilityController } from '../controllers/ProbabilityController';
import { computeCollectValue, canCollect } from './paytable';

export interface SimResult {
  rtp: number;
  symbolFrequencies: Record<SymbolId, number>;
  avgRoundLength: number;
  avgPayout: number;
  tumbleweedResetFrequency: number;
  collectDistribution: Record<string, number>;
  flowerBonusHits: number;
  totalRounds: number;
  totalSpins: number;
  totalWagered: number;
  totalPaid: number;
}

function clamp(v: number, max: number): number {
  return v > max ? max : v;
}

export function simulate(rounds = 1_000_000, bet = 1, seed?: number): SimResult {
  const rng = new RNG(seed ?? randomSeed());
  const pc = new ProbabilityController();

  let totalWagered = 0;
  let totalPaid = 0;
  let totalSpins = 0;
  let tumbleweedResets = 0;
  let flowerBonusHits = 0;

  const symbolCounts: Record<SymbolId, number> = {
    Clover: 0, ForgetMeNot: 0, Rose: 0, GoldenSeed: 0, Tumbleweed: 0
  };
  const collectDist: Record<string, number> = {};

  for (let r = 0; r < rounds; r++) {
    let clover = 0, forget = 0, rose = 0;
    let collected = false;

    while (!collected) {
      // Pre-decide outcome
      const roll = rng.next();
      const symbol = pc.resolve(roll);
      symbolCounts[symbol]++;
      totalSpins++;
      totalWagered += bet;

      // Apply symbol
      switch (symbol) {
        case 'Clover':      clover = clamp(clover + 1, MAX_LEVEL); break;
        case 'ForgetMeNot': forget = clamp(forget + 1, MAX_LEVEL); break;
        case 'Rose':        rose   = clamp(rose   + 1, MAX_LEVEL); break;
        case 'GoldenSeed':
          clover = clamp(clover + 1, MAX_LEVEL);
          forget = clamp(forget + 1, MAX_LEVEL);
          rose   = clamp(rose   + 1, MAX_LEVEL);
          break;
        case 'Tumbleweed':
          clover = 0; forget = 0; rose = 0;
          tumbleweedResets++;
          break;
      }

      const cv = computeCollectValue(clover, forget, rose, bet);
      const enabled = canCollect(cv, bet);

      // Strategy: collect as soon as enabled
      if (enabled) {
        if (clover === MAX_LEVEL && forget === MAX_LEVEL && rose === MAX_LEVEL) {
          flowerBonusHits++;
        }
        totalPaid += cv;
        const key = String(cv);
        collectDist[key] = (collectDist[key] ?? 0) + 1;
        collected = true;
      }
      // Tumbleweed already wiped, round continues (forced to spin again)
    }

  }

  const avgRoundLength = totalSpins / rounds;
  const avgPayout = totalPaid / rounds;
  const rtp = totalPaid / totalWagered;

  return {
    rtp,
    symbolFrequencies: symbolCounts,
    avgRoundLength,
    avgPayout,
    tumbleweedResetFrequency: tumbleweedResets / totalSpins,
    collectDistribution: collectDist,
    flowerBonusHits,
    totalRounds: rounds,
    totalSpins,
    totalWagered,
    totalPaid,
  };
}

export function printSimResult(result: SimResult): void {
  const RTP_TARGET = 0.94996;
  const RTP_TOLERANCE = 0.005;
  const rtpPass = Math.abs(result.rtp - RTP_TARGET) <= RTP_TOLERANCE;

  console.log('=== FLOWER LADDER ONE-REEL SLOT — SIMULATION RESULTS ===');
  console.log(`Rounds simulated:      ${result.totalRounds.toLocaleString()}`);
  console.log(`Total spins:           ${result.totalSpins.toLocaleString()}`);
  console.log(`Total wagered:         ${result.totalWagered.toLocaleString()} FUN`);
  console.log(`Total paid:            ${result.totalPaid.toFixed(2)} FUN`);
  console.log('');
  console.log(`RTP:                   ${(result.rtp * 100).toFixed(3)}%`);
  console.log(`RTP target:            ${(RTP_TARGET * 100).toFixed(3)}%`);
  console.log(`RTP check:             ${rtpPass ? '✓ PASS' : '✗ FAIL'} (tolerance ±${(RTP_TOLERANCE*100).toFixed(1)}%)`);
  console.log('');
  console.log(`Avg round length:      ${result.avgRoundLength.toFixed(2)} spins`);
  console.log(`Avg payout per round:  ${result.avgPayout.toFixed(4)}x bet`);
  console.log('');
  console.log(`Tumbleweed resets/spin: ${(result.tumbleweedResetFrequency * 100).toFixed(2)}%`);
  console.log(`Flower bonus hits:      ${result.flowerBonusHits.toLocaleString()}`);
  console.log('');
  console.log('Symbol frequencies (of total spins):');
  for (const [sym, count] of Object.entries(result.symbolFrequencies)) {
    const pct = (count / result.totalSpins * 100).toFixed(3);
    console.log(`  ${sym.padEnd(14)} ${count.toLocaleString().padStart(10)}  (${pct}%)`);
  }
  console.log('');
  console.log('Collect value distribution (top 20):');
  const sorted = Object.entries(result.collectDistribution)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .slice(0, 20);
  for (const [val, cnt] of sorted) {
    const pct = (cnt / result.totalRounds * 100).toFixed(3);
    console.log(`  ${String(val).padStart(6)} FUN: ${String(cnt).padStart(10)}  (${pct}%)`);
  }
}

// To run the simulation from the command line:
//   npx tsx src/game/math/simulate.ts
// Or press S in the browser (DEV mode) to run a 100k round simulation in the console.
