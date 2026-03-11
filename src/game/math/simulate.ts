/**
 * Simulation engine — RTP validation + emotional gameplay feel metrics.
 *
 * Strategy bot: collect immediately when the collect button activates
 * (collectValue >= COLLECT_MULTIPLIER * bet). This is the natural greedy
 * strategy and gives the most conservative RTP estimate.
 *
 * Run: npx tsx scripts/simulate.ts [rounds]
 * Or press S in the browser (DEV mode) for a 100k-round run in console.
 */
import { MAX_LEVEL, type SymbolId } from './paytable';
import { RNG, randomSeed } from '../utils/RNG';
import { ProbabilityController } from '../controllers/ProbabilityController';
import { computeCollectValue, canCollect, COLLECT_MULTIPLIER } from './paytable';

// ── Result type ──────────────────────────────────────────────────────────────

export interface SimResult {
  // ── Core ────────────────────────────────────────────────────────────────
  rtp: number;
  totalRounds: number;
  totalSpins: number;
  totalWagered: number;
  totalPaid: number;

  // ── Round shape ─────────────────────────────────────────────────────────
  avgRoundLength: number;       // spins per round
  avgPayout: number;            // payout per round (in bet units)

  // ── Danger ──────────────────────────────────────────────────────────────
  tumbleweedResetFrequency: number; // tumbleweeds / total spins
  avgTumbleweeds: number;           // average wipes per round
  flowerBonusHits: number;

  // ── Feel / progression metrics ──────────────────────────────────────────
  /**
   * Peak total ladder levels (sum of all three ladders) reached at any point
   * during each round — averaged across all rounds.
   */
  avgPeakLevels: number;

  /**
   * Highest collect value the player's state reached at any point during the
   * round (before Tumbleweed wipes or before collection). Averaged.
   */
  avgPeakCollectValue: number;

  /**
   * % of rounds where the peak total ladder levels ever reached ≥ threshold.
   * Indicates "did the player feel like they were building something".
   */
  pctReachedAtLeast1Level: number;   // any ladder progress at all
  pctReachedAtLeast3Levels: number;  // noticeable progress
  pctReachedAtLeast5Levels: number;  // meaningful accumulation

  /**
   * % of rounds where the player never exceeded peakTotalLevels < 2 before
   * collecting — a proxy for "empty / punishing round".
   */
  pctEndedWithoutMeaningfulAccumulation: number;

  // ── Distributions ────────────────────────────────────────────────────────
  symbolFrequencies: Record<SymbolId, number>;
  collectDistribution: Record<string, number>; // collectValue → occurrences
}

// ── Engine ───────────────────────────────────────────────────────────────────

function clamp(v: number, max: number): number {
  return v > max ? max : v;
}

export function simulate(rounds = 1_000_000, bet = 1, seed?: number): SimResult {
  const rng = new RNG(seed ?? randomSeed());
  const pc  = new ProbabilityController();

  let totalWagered = 0;
  let totalPaid    = 0;
  let totalSpins   = 0;
  let totalTumbleweeds = 0;
  let flowerBonusHits  = 0;

  // Feel metric accumulators
  let sumPeakLevels       = 0;
  let sumPeakCollectValue = 0;
  let cntReached1Level    = 0;
  let cntReached3Levels   = 0;
  let cntReached5Levels   = 0;
  let cntNoMeaningful     = 0; // peakTotalLevels < 2

  const symbolCounts: Record<SymbolId, number> = {
    Clover: 0, ForgetMeNot: 0, Rose: 0, GoldenSeed: 0, Tumbleweed: 0,
  };
  const collectDist: Record<string, number> = {};

  for (let r = 0; r < rounds; r++) {
    let clover = 0, forget = 0, rose = 0;
    let collected = false;

    // Per-round feel tracking
    let peakTotalLevels = 0;
    let peakCollectValue = 0;

    while (!collected) {
      const roll   = rng.next();
      const symbol = pc.resolve(roll);
      symbolCounts[symbol]++;
      totalSpins++;
      totalWagered += bet;

      // Apply symbol (same logic as OutcomeController)
      switch (symbol) {
        case 'Clover':
          clover = clamp(clover + 1, MAX_LEVEL);
          break;
        case 'ForgetMeNot':
          forget = clamp(forget + 1, MAX_LEVEL);
          break;
        case 'Rose':
          rose = clamp(rose + 1, MAX_LEVEL);
          break;
        case 'GoldenSeed':
          clover = clamp(clover + 1, MAX_LEVEL);
          forget = clamp(forget + 1, MAX_LEVEL);
          rose   = clamp(rose   + 1, MAX_LEVEL);
          break;
        case 'Tumbleweed':
          totalTumbleweeds++;
          // Track peak BEFORE wipe
          {
            const totalLevels = clover + forget + rose;
            if (totalLevels > peakTotalLevels) peakTotalLevels = totalLevels;
            const cv = computeCollectValue(clover, forget, rose, bet);
            if (cv > peakCollectValue) peakCollectValue = cv;
          }
          clover = 0; forget = 0; rose = 0;
          break;
      }

      if (symbol !== 'Tumbleweed') {
        const totalLevels = clover + forget + rose;
        if (totalLevels > peakTotalLevels) peakTotalLevels = totalLevels;
      }

      const cv      = computeCollectValue(clover, forget, rose, bet);
      if (cv > peakCollectValue) peakCollectValue = cv;
      const enabled = canCollect(cv, bet);

      if (enabled) {
        if (clover === MAX_LEVEL && forget === MAX_LEVEL && rose === MAX_LEVEL) {
          flowerBonusHits++;
        }
        totalPaid += cv;
        const key = String(cv);
        collectDist[key] = (collectDist[key] ?? 0) + 1;
        collected = true;
      }
    }

    // Aggregate feel metrics for this round
    sumPeakLevels       += peakTotalLevels;
    sumPeakCollectValue += peakCollectValue;
    if (peakTotalLevels >= 1) cntReached1Level++;
    if (peakTotalLevels >= 3) cntReached3Levels++;
    if (peakTotalLevels >= 5) cntReached5Levels++;
    if (peakTotalLevels < 2)  cntNoMeaningful++;
  }

  return {
    rtp: totalPaid / totalWagered,
    totalRounds:  rounds,
    totalSpins,
    totalWagered,
    totalPaid,

    avgRoundLength: totalSpins / rounds,
    avgPayout:      totalPaid  / rounds,

    tumbleweedResetFrequency: totalTumbleweeds / totalSpins,
    avgTumbleweeds:           totalTumbleweeds / rounds,
    flowerBonusHits,

    avgPeakLevels:       sumPeakLevels       / rounds,
    avgPeakCollectValue: sumPeakCollectValue  / rounds,
    pctReachedAtLeast1Level:  cntReached1Level  / rounds,
    pctReachedAtLeast3Levels: cntReached3Levels / rounds,
    pctReachedAtLeast5Levels: cntReached5Levels / rounds,
    pctEndedWithoutMeaningfulAccumulation: cntNoMeaningful / rounds,

    symbolFrequencies:   symbolCounts,
    collectDistribution: collectDist,
  };
}

// ── Pretty-printer ───────────────────────────────────────────────────────────

export function printSimResult(result: SimResult): void {
  const RTP_TARGET    = 0.95;
  const RTP_TOLERANCE = 0.005;
  const rtpPass = Math.abs(result.rtp - RTP_TARGET) <= RTP_TOLERANCE;

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const sep = '─'.repeat(56);

  console.log('╔' + '═'.repeat(54) + '╗');
  console.log('║   FLOWER LADDER ONE-REEL SLOT — SIMULATION RESULTS   ║');
  console.log('╚' + '═'.repeat(54) + '╝');
  console.log('');

  console.log('── Core ─────────────────────────────────────────────────');
  console.log(`  Rounds simulated:      ${result.totalRounds.toLocaleString()}`);
  console.log(`  Total spins:           ${result.totalSpins.toLocaleString()}`);
  console.log(`  Total wagered:         ${result.totalWagered.toLocaleString()} FUN`);
  console.log(`  Total paid:            ${result.totalPaid.toFixed(2)} FUN`);
  console.log('');

  console.log('── RTP ──────────────────────────────────────────────────');
  const rtpStr   = `${(result.rtp * 100).toFixed(3)}%`;
  const checkStr = rtpPass ? '✓ PASS' : '✗ FAIL';
  console.log(`  RTP:                   ${rtpStr}`);
  console.log(`  Target:                ${(RTP_TARGET * 100).toFixed(3)}%`);
  console.log(`  Check (±${(RTP_TOLERANCE*100).toFixed(1)}%):        ${checkStr}`);
  console.log(`  Collect multiplier:    ${COLLECT_MULTIPLIER}×`);
  console.log('');

  console.log('── Round shape ──────────────────────────────────────────');
  console.log(`  Avg round length:      ${result.avgRoundLength.toFixed(2)} spins`);
  console.log(`  Avg payout per round:  ${result.avgPayout.toFixed(3)}× bet`);
  console.log('');

  console.log('── Danger ───────────────────────────────────────────────');
  console.log(`  Tumbleweed / spin:     ${pct(result.tumbleweedResetFrequency)}`);
  console.log(`  Avg tumbleweeds/round: ${result.avgTumbleweeds.toFixed(2)}`);
  console.log(`  Flower bonus hits:     ${result.flowerBonusHits.toLocaleString()}`);
  console.log('');

  console.log('── Feel / Progression ───────────────────────────────────');
  console.log(`  Avg peak ladder total: ${result.avgPeakLevels.toFixed(2)} levels`);
  console.log(`  Avg peak collect val:  ${result.avgPeakCollectValue.toFixed(2)}× bet`);
  console.log('');
  console.log(`  Rounds ≥ 1 ladder step:  ${pct(result.pctReachedAtLeast1Level)}  (any progress at all)`);
  console.log(`  Rounds ≥ 3 ladder steps: ${pct(result.pctReachedAtLeast3Levels)}  (noticeable accumulation)`);
  console.log(`  Rounds ≥ 5 ladder steps: ${pct(result.pctReachedAtLeast5Levels)}  (strong accumulation)`);
  console.log(`  Rounds < 2 steps (empty):${pct(result.pctEndedWithoutMeaningfulAccumulation)}  (felt punishing)`);
  console.log('');

  console.log('── Symbol frequencies ───────────────────────────────────');
  for (const [sym, count] of Object.entries(result.symbolFrequencies)) {
    const p = pct(count / result.totalSpins);
    console.log(`  ${sym.padEnd(14)} ${count.toLocaleString().padStart(10)}  (${p})`);
  }
  console.log('');

  console.log('── Collect value distribution (top 25 by value) ─────────');
  const sorted = Object.entries(result.collectDistribution)
    .map(([v, c]) => [Number(v), c] as [number, number])
    .sort((a, b) => b[0] - a[0])
    .slice(0, 25);
  for (const [val, cnt] of sorted) {
    const p = pct(cnt / result.totalRounds);
    console.log(`  ${String(val).padStart(6)}×: ${String(cnt).padStart(10)}  (${p})`);
  }
  console.log(sep);
}
