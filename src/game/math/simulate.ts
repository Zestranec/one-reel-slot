/**
 * Simulation engine — RTP validation + emotional gameplay feel metrics.
 *
 * Three bot strategies:
 *   greedy  — collect immediately when collectValue >= 5× bet
 *   medium  — collect at 8×+, skip if all ladders ≥ L4, force-collect at 15×
 *   chaser  — collect only at 20×+ or all-L5 (Flower Bonus)
 *
 * Run: npx tsx scripts/simulate.ts [rounds]
 * Or press S in the browser (DEV mode) for a 100k-round run in console.
 */
import { MAX_LEVEL, type SymbolId } from './paytable';
import { RNG, randomSeed } from '../utils/RNG';
import { ProbabilityController } from '../controllers/ProbabilityController';
import { computeCollectValue, canCollect, COLLECT_MULTIPLIER } from './paytable';

// ── Bot strategy ─────────────────────────────────────────────────────────────

export type BotStrategy = 'greedy' | 'medium' | 'chaser';

/**
 * Returns true if the bot should collect right now.
 * Only called when canCollect() is already true (cv >= COLLECT_MULTIPLIER * bet).
 */
function botDecide(
  strategy: BotStrategy,
  cv: number,
  bet: number,
  clover: number,
  forget: number,
  rose: number,
): boolean {
  switch (strategy) {
    case 'greedy':
      return true; // collect at the threshold

    case 'medium': {
      if (cv >= 15 * bet) return true; // force-collect
      if (clover >= 4 && forget >= 4 && rose >= 4) return false; // all-L4+ chase
      return cv >= 8 * bet;
    }

    case 'chaser':
      if (clover === MAX_LEVEL && forget === MAX_LEVEL && rose === MAX_LEVEL) return true;
      return cv >= 20 * bet;
  }
}

// ── Result type ──────────────────────────────────────────────────────────────

export interface SimResult {
  strategy: BotStrategy;

  // ── Core ────────────────────────────────────────────────────────────────
  rtp: number;
  totalRounds: number;
  totalSpins: number;
  totalWagered: number;
  totalPaid: number;

  // ── Round shape ─────────────────────────────────────────────────────────
  avgRoundLength: number;
  avgPayout: number;

  // ── Danger ──────────────────────────────────────────────────────────────
  tumbleweedResetFrequency: number;
  avgTumbleweeds: number;
  flowerBonusHits: number;

  // ── Feel / progression ───────────────────────────────────────────────────
  avgPeakLevels: number;
  avgPeakCollectValue: number;

  pctReachedAtLeast1Level: number;
  pctReachedAtLeast3Levels: number;
  pctReachedAtLeast5Levels: number;
  pctReachedAtLeast8Levels: number;

  /** % rounds where at least one / two ladders individually hit L5 at any point. */
  pctAtLeastOneL5: number;
  pctAtLeastTwoL5: number;

  pctEndedWithoutMeaningfulAccumulation: number;

  // ── Distributions ────────────────────────────────────────────────────────
  symbolFrequencies: Record<SymbolId, number>;
  collectDistribution: Record<string, number>;
}

// ── Engine ───────────────────────────────────────────────────────────────────

function clamp(v: number, max: number): number {
  return v > max ? max : v;
}

export function simulate(
  rounds = 1_000_000,
  bet = 1,
  seed?: number,
  strategy: BotStrategy = 'greedy',
): SimResult {
  const rng = new RNG(seed ?? randomSeed());
  const pc  = new ProbabilityController();

  let totalWagered     = 0;
  let totalPaid        = 0;
  let totalSpins       = 0;
  let totalTumbleweeds = 0;
  let flowerBonusHits  = 0;

  let sumPeakLevels       = 0;
  let sumPeakCollectValue = 0;
  let cntReached1Level    = 0;
  let cntReached3Levels   = 0;
  let cntReached5Levels   = 0;
  let cntReached8Levels   = 0;
  let cntAtLeastOneL5     = 0;
  let cntAtLeastTwoL5     = 0;
  let cntNoMeaningful     = 0;

  const symbolCounts: Record<SymbolId, number> = {
    Clover: 0, ForgetMeNot: 0, Rose: 0, GoldenSeed: 0, Tumbleweed: 0,
  };
  const collectDist: Record<string, number> = {};

  for (let r = 0; r < rounds; r++) {
    let clover = 0, forget = 0, rose = 0;
    let collected = false;

    let peakTotalLevels  = 0;
    let peakCollectValue = 0;
    let maxClover        = 0;
    let maxForget        = 0;
    let maxRose          = 0;

    while (!collected) {
      const roll   = rng.next();
      const symbol = pc.resolve(roll);
      symbolCounts[symbol]++;
      totalSpins++;
      totalWagered += bet;

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
          // Capture peak BEFORE wiping ladders.
          {
            const tl = clover + forget + rose;
            if (tl > peakTotalLevels) peakTotalLevels = tl;
            const cv0 = computeCollectValue(clover, forget, rose, bet);
            if (cv0 > peakCollectValue) peakCollectValue = cv0;
          }
          if (clover > maxClover) maxClover = clover;
          if (forget > maxForget) maxForget = forget;
          if (rose   > maxRose)   maxRose   = rose;
          clover = 0; forget = 0; rose = 0;
          break;
      }

      if (symbol !== 'Tumbleweed') {
        const tl = clover + forget + rose;
        if (tl > peakTotalLevels) peakTotalLevels = tl;
        if (clover > maxClover) maxClover = clover;
        if (forget > maxForget) maxForget = forget;
        if (rose   > maxRose)   maxRose   = rose;
      }

      const cv      = computeCollectValue(clover, forget, rose, bet);
      if (cv > peakCollectValue) peakCollectValue = cv;
      const enabled = canCollect(cv, bet);

      if (enabled && botDecide(strategy, cv, bet, clover, forget, rose)) {
        if (clover === MAX_LEVEL && forget === MAX_LEVEL && rose === MAX_LEVEL) {
          flowerBonusHits++;
        }
        totalPaid += cv;
        const key = String(cv);
        collectDist[key] = (collectDist[key] ?? 0) + 1;
        collected = true;
      }
    }

    sumPeakLevels       += peakTotalLevels;
    sumPeakCollectValue += peakCollectValue;
    if (peakTotalLevels >= 1) cntReached1Level++;
    if (peakTotalLevels >= 3) cntReached3Levels++;
    if (peakTotalLevels >= 5) cntReached5Levels++;
    if (peakTotalLevels >= 8) cntReached8Levels++;
    if (peakTotalLevels < 2)  cntNoMeaningful++;

    const l5Count = (maxClover === MAX_LEVEL ? 1 : 0)
                  + (maxForget === MAX_LEVEL ? 1 : 0)
                  + (maxRose   === MAX_LEVEL ? 1 : 0);
    if (l5Count >= 1) cntAtLeastOneL5++;
    if (l5Count >= 2) cntAtLeastTwoL5++;
  }

  return {
    strategy,
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
    pctReachedAtLeast8Levels: cntReached8Levels / rounds,
    pctAtLeastOneL5:          cntAtLeastOneL5   / rounds,
    pctAtLeastTwoL5:          cntAtLeastTwoL5   / rounds,
    pctEndedWithoutMeaningfulAccumulation: cntNoMeaningful / rounds,

    symbolFrequencies:   symbolCounts,
    collectDistribution: collectDist,
  };
}

// ── Pretty-printer ───────────────────────────────────────────────────────────

export function printSimResult(result: SimResult): void {
  const RTP_TARGET    = 0.975;
  const RTP_TOLERANCE = 0.010;
  const rtpPass = Math.abs(result.rtp - RTP_TARGET) <= RTP_TOLERANCE;

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const sep = '─'.repeat(60);

  const STRATEGY_LABELS: Record<BotStrategy, string> = {
    greedy: 'Bot A — Greedy Threshold  (collect at 5×)',
    medium: 'Bot B — Medium Risk        (collect at 8×, chase L4+)',
    chaser: 'Bot C — Bonus Chaser       (collect at 20× or Flower)',
  };

  console.log('╔' + '═'.repeat(60) + '╗');
  console.log(`║  ${STRATEGY_LABELS[result.strategy].padEnd(58)}║`);
  console.log('╚' + '═'.repeat(60) + '╝');
  console.log('');

  console.log('── Core ──────────────────────────────────────────────────────');
  console.log(`  Rounds simulated:        ${result.totalRounds.toLocaleString()}`);
  console.log(`  Total spins:             ${result.totalSpins.toLocaleString()}`);
  console.log(`  Total wagered:           ${result.totalWagered.toLocaleString()} FUN`);
  console.log(`  Total paid:              ${result.totalPaid.toFixed(0)} FUN`);
  console.log('');

  console.log('── RTP ───────────────────────────────────────────────────────');
  console.log(`  RTP:                     ${(result.rtp * 100).toFixed(3)}%`);
  console.log(`  Target:                  ${(RTP_TARGET * 100).toFixed(1)}%`);
  console.log(`  Check (±${(RTP_TOLERANCE * 100).toFixed(0)}%):              ${rtpPass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Collect multiplier:      ${COLLECT_MULTIPLIER}×`);
  console.log('');

  console.log('── Round shape ───────────────────────────────────────────────');
  console.log(`  Avg round length:        ${result.avgRoundLength.toFixed(2)} spins`);
  console.log(`  Avg payout per round:    ${result.avgPayout.toFixed(3)}× bet`);
  console.log('');

  console.log('── Danger ────────────────────────────────────────────────────');
  console.log(`  Tumbleweed / spin:       ${pct(result.tumbleweedResetFrequency)}`);
  console.log(`  Avg tumbleweeds/round:   ${result.avgTumbleweeds.toFixed(2)}`);
  console.log(`  Flower bonus hits:       ${result.flowerBonusHits.toLocaleString()}`);
  console.log('');

  console.log('── Feel / Progression ────────────────────────────────────────');
  console.log(`  Avg peak ladder total:   ${result.avgPeakLevels.toFixed(2)} levels`);
  console.log(`  Avg peak collect val:    ${result.avgPeakCollectValue.toFixed(2)}× bet`);
  console.log('');
  console.log(`  Rounds ≥ 1 step:         ${pct(result.pctReachedAtLeast1Level)}`);
  console.log(`  Rounds ≥ 3 steps:        ${pct(result.pctReachedAtLeast3Levels)}`);
  console.log(`  Rounds ≥ 5 steps:        ${pct(result.pctReachedAtLeast5Levels)}`);
  console.log(`  Rounds ≥ 8 steps:        ${pct(result.pctReachedAtLeast8Levels)}`);
  console.log(`  At least one L5 hit:     ${pct(result.pctAtLeastOneL5)}`);
  console.log(`  At least two L5 hit:     ${pct(result.pctAtLeastTwoL5)}`);
  console.log(`  Rounds < 2 steps:        ${pct(result.pctEndedWithoutMeaningfulAccumulation)}  (empty/punishing)`);
  console.log('');

  console.log('── Symbol frequencies ────────────────────────────────────────');
  for (const [sym, count] of Object.entries(result.symbolFrequencies)) {
    const p = pct(count / result.totalSpins);
    console.log(`  ${sym.padEnd(14)} ${count.toLocaleString().padStart(12)}  (${p})`);
  }
  console.log('');

  console.log('── Collect value distribution (top 30 by value) ──────────────');
  const sorted = Object.entries(result.collectDistribution)
    .map(([v, c]) => [Number(v), c] as [number, number])
    .sort((a, b) => b[0] - a[0])
    .slice(0, 30);
  for (const [val, cnt] of sorted) {
    const p = pct(cnt / result.totalRounds);
    console.log(`  ${String(val).padStart(6)}×: ${String(cnt).padStart(10)}  (${p})`);
  }
  console.log(sep);
  console.log('');
}
