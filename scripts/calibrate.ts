/**
 * Calibration script — finds the payout scale factor that hits 95% RTP.
 * Run: npx tsx scripts/calibrate.ts
 *
 * Uses the current probability profile (Tumbleweed 49%, collect threshold 5×)
 * and sweeps the payout multiplier to bracket the 95% target.
 */
import {
  MAX_LEVEL, type SymbolId,
  COLLECT_MULTIPLIER,
} from '../src/game/math/paytable.js';
import { RNG } from '../src/game/utils/RNG.js';
import { ProbabilityController } from '../src/game/controllers/ProbabilityController.js';

// ── Base paytable (the user-proposed candidate, before scaling) ──────────────
const BASE_CLOVER  = [0,  2,  6, 18,  50, 140];
const BASE_FMN     = [0,  1,  3,  7,  16,  40];
const BASE_ROSE    = [0,  1,  2,  3,   5,   8];
const BASE_FLOWER  = 250;

function computeCV(c: number, f: number, r: number, scale: number, bet: number): number {
  const bonus = (c === MAX_LEVEL && f === MAX_LEVEL && r === MAX_LEVEL)
    ? BASE_FLOWER * scale : 0;
  return (BASE_CLOVER[c] * scale + BASE_FMN[f] * scale + BASE_ROSE[r] * scale + bonus) * bet;
}

function clamp(v: number, max: number): number { return v > max ? max : v; }

function runSim(scale: number, rounds = 200_000): { rtp: number; avgN: number; avgCV: number } {
  const rng = new RNG(42); // fixed seed for reproducibility
  const pc  = new ProbabilityController();
  const bet = 1;
  const threshold = COLLECT_MULTIPLIER * bet;

  let totalWagered = 0, totalPaid = 0, totalSpins = 0;

  for (let r = 0; r < rounds; r++) {
    let c = 0, f = 0, ro = 0;
    let done = false;
    while (!done) {
      const sym = pc.resolve(rng.next()) as SymbolId;
      totalSpins++; totalWagered += bet;
      switch (sym) {
        case 'Clover':      c  = clamp(c  + 1, MAX_LEVEL); break;
        case 'ForgetMeNot': f  = clamp(f  + 1, MAX_LEVEL); break;
        case 'Rose':        ro = clamp(ro + 1, MAX_LEVEL); break;
        case 'GoldenSeed':
          c = clamp(c+1, MAX_LEVEL); f = clamp(f+1, MAX_LEVEL); ro = clamp(ro+1, MAX_LEVEL);
          break;
        case 'Tumbleweed':  c = 0; f = 0; ro = 0; break;
      }
      const cv = computeCV(c, f, ro, scale, bet);
      if (cv >= threshold) { totalPaid += cv; done = true; }
    }
  }
  return {
    rtp:   totalPaid / totalWagered,
    avgN:  totalSpins / rounds,
    avgCV: totalPaid  / rounds,
  };
}

// ── Integer-paytable spot-tests ───────────────────────────────────────────────
// Tests specific round-number candidates and reports RTP + feel metrics.

interface IntTable {
  label: string;
  clover: readonly number[];
  fmn: readonly number[];
  rose: readonly number[];
  flower: number;
  threshold: number; // = COLLECT_MULTIPLIER * bet
}

function runSimInt(t: IntTable, rounds = 300_000): { rtp: number; avgN: number; avgCV: number; pct3: number } {
  const rng = new RNG(42);
  const pc  = new ProbabilityController();
  const bet = 1;
  let totalWagered = 0, totalPaid = 0, totalSpins = 0, cnt3 = 0;

  for (let r = 0; r < rounds; r++) {
    let c = 0, f = 0, ro = 0;
    let done = false, peak = 0;
    while (!done) {
      const sym = pc.resolve(rng.next()) as SymbolId;
      totalSpins++; totalWagered += bet;
      switch (sym) {
        case 'Clover':      c  = clamp(c +1, MAX_LEVEL); break;
        case 'ForgetMeNot': f  = clamp(f +1, MAX_LEVEL); break;
        case 'Rose':        ro = clamp(ro+1, MAX_LEVEL); break;
        case 'GoldenSeed':
          c=clamp(c+1,MAX_LEVEL); f=clamp(f+1,MAX_LEVEL); ro=clamp(ro+1,MAX_LEVEL); break;
        case 'Tumbleweed': c=0; f=0; ro=0; break;
      }
      const p = c+f+ro; if (p > peak) peak = p;
      const bonus = (c===MAX_LEVEL && f===MAX_LEVEL && ro===MAX_LEVEL) ? t.flower : 0;
      const cv = (t.clover[c] + t.fmn[f] + t.rose[ro] + bonus) * bet;
      if (cv >= t.threshold) { totalPaid += cv; done = true; }
    }
    if (peak >= 3) cnt3++;
  }
  return { rtp: totalPaid/totalWagered, avgN: totalSpins/rounds,
           avgCV: totalPaid/rounds, pct3: cnt3/rounds };
}

const CANDIDATES: IntTable[] = [
  // A (baseline): Clover+Rose=5 shortcut enabled → RTP=92.73%
  { label: 'A  R1=2 th=5  (baseline)',
    clover: [0,  3, 10, 30, 83, 232],
    fmn:   [0,  1,  4, 12, 27,  66],
    rose:  [0,  2,  3,  5,  8,  13],
    flower: 415, threshold: 5 },

  // B: Rose L1 1→1 so C+R=4<5, min collect = C1+F1+R1=5 (3 symbols)
  { label: 'B  R1=1 th=5',
    clover: [0,  3, 10, 30, 83, 232],
    fmn:   [0,  1,  4, 12, 27,  66],
    rose:  [0,  1,  3,  5,  8,  13],
    flower: 415, threshold: 5 },

  // B2: B + bump FMN and Clover lower tiers slightly
  { label: 'B2 R1=1 F1=2 th=5',
    clover: [0,  3, 10, 30, 83, 232],
    fmn:   [0,  2,  5, 12, 27,  66],
    rose:  [0,  1,  3,  5,  8,  13],
    flower: 415, threshold: 5 },

  // B3: B + slightly higher Rose upper tiers
  { label: 'B3 R1=1 R3=6 R4=10 R5=15 th=5',
    clover: [0,  3, 10, 30, 83, 232],
    fmn:   [0,  1,  4, 12, 27,  66],
    rose:  [0,  1,  3,  6, 10,  15],
    flower: 415, threshold: 5 },

  // B4: threshold 5→4 with Candidate A payouts (lowers bar, more collects)
  { label: 'B4 R1=2 th=4',
    clover: [0,  3, 10, 30, 83, 232],
    fmn:   [0,  1,  4, 12, 27,  66],
    rose:  [0,  2,  3,  5,  8,  13],
    flower: 415, threshold: 4 },

  // B5: B + threshold 4 (min collect = C1+R1=4)
  { label: 'B5 R1=1 th=4',
    clover: [0,  3, 10, 30, 83, 232],
    fmn:   [0,  1,  4, 12, 27,  66],
    rose:  [0,  1,  3,  5,  8,  13],
    flower: 415, threshold: 4 },

  // B7: B2 but close FMN L2 standalone path (FMN[2] 5→4) — target sweet spot
  { label: 'B7 R1=1 F1=2 F2=4 th=5',
    clover: [0,  3, 10, 30, 83, 232],
    fmn:   [0,  2,  4, 12, 27,  66],
    rose:  [0,  1,  3,  5,  8,  13],
    flower: 415, threshold: 5 },

  // B8: B7 + also close Rose L3 standalone path (ROSE[3] 5→4)
  { label: 'B8 R1=1 F1=2 F2=4 R3=4 th=5',
    clover: [0,  3, 10, 30, 83, 232],
    fmn:   [0,  2,  4, 12, 27,  66],
    rose:  [0,  1,  3,  4,  8,  13],
    flower: 415, threshold: 5 },

  // B9: B7 but Clover L1=2 instead of 3 (C1+F1=4<5, closes 2-symbol paths)
  { label: 'B9 C1=2 F1=2 F2=4 R1=1 th=5',
    clover: [0,  2, 10, 30, 83, 232],
    fmn:   [0,  2,  4, 12, 27,  66],
    rose:  [0,  1,  3,  5,  8,  13],
    flower: 415, threshold: 5 },
];

// ── Tumbleweed-probability sweep with Candidate-A payouts ────────────────────
// Custom resolver (bypasses ProbabilityController so we can vary probabilities
// without touching paytable.ts).

const A_CLOVER  = [0,  3, 10, 30, 83, 232];
const A_FMN     = [0,  1,  4, 12, 27,  66];
const A_ROSE    = [0,  2,  3,  5,  8,  13];
const A_FLOWER  = 415;
const A_THRESH  = 5;

type SymId = 'Clover' | 'ForgetMeNot' | 'Rose' | 'GoldenSeed' | 'Tumbleweed';

function makeResolver(c: number, f: number, r: number, gs: number, tw: number) {
  const thresholds = [c, c+f, c+f+r, c+f+r+gs, 1.0];
  const ids: SymId[] = ['Clover', 'ForgetMeNot', 'Rose', 'GoldenSeed', 'Tumbleweed'];
  return (roll: number): SymId => {
    for (let i = 0; i < thresholds.length; i++) if (roll < thresholds[i]) return ids[i];
    return 'Tumbleweed';
  };
}

interface ProbaTest { label: string; probs: [number,number,number,number,number]; }
const TW_TESTS: ProbaTest[] = [
  { label: 'Tw=0.49 (spec)',   probs: [0.10, 0.14, 0.20, 0.07, 0.49] },
  { label: 'Tw=0.488',        probs: [0.102,0.14, 0.20, 0.07, 0.488] },
  { label: 'Tw=0.486',        probs: [0.104,0.14, 0.20, 0.07, 0.486] },
  { label: 'Tw=0.484',        probs: [0.106,0.14, 0.20, 0.07, 0.484] },
  { label: 'Tw=0.482',        probs: [0.108,0.14, 0.20, 0.07, 0.482] },
  { label: 'Tw=0.480',        probs: [0.11, 0.14, 0.20, 0.07, 0.48 ] },
  { label: 'Tw=0.478',        probs: [0.11, 0.14, 0.202,0.07, 0.478] },
  { label: 'Tw=0.476',        probs: [0.11, 0.14, 0.204,0.07, 0.476] },
  { label: 'Tw=0.474',        probs: [0.11, 0.14, 0.206,0.07, 0.474] },
  { label: 'Tw=0.472',        probs: [0.11, 0.14, 0.208,0.07, 0.472] },
  { label: 'Tw=0.470',        probs: [0.11, 0.14, 0.21, 0.07, 0.47 ] },
  { label: 'Tw=0.47',         probs: [0.11, 0.14, 0.21, 0.07, 0.47] },
];

function runSimProba(p: ProbaTest, rounds = 300_000): { rtp: number; avgN: number; avgCV: number; pct3: number; avgTw: number } {
  const rng = new RNG(42);
  const resolve = makeResolver(...p.probs);
  const bet = 1;
  let tw = 0, wg = 0, pd = 0, sp = 0, c3 = 0;

  for (let r = 0; r < rounds; r++) {
    let c=0, f=0, ro=0, peak=0, twR=0;
    let done = false;
    while (!done) {
      const sym = resolve(rng.next());
      sp++; wg += bet;
      switch (sym) {
        case 'Clover':      c  = clamp(c +1, MAX_LEVEL); break;
        case 'ForgetMeNot': f  = clamp(f +1, MAX_LEVEL); break;
        case 'Rose':        ro = clamp(ro+1, MAX_LEVEL); break;
        case 'GoldenSeed':
          c=clamp(c+1,MAX_LEVEL); f=clamp(f+1,MAX_LEVEL); ro=clamp(ro+1,MAX_LEVEL); break;
        case 'Tumbleweed': c=0; f=0; ro=0; tw++; twR++; break;
      }
      const p2 = c+f+ro; if (p2 > peak) peak = p2;
      const bonus = (c===MAX_LEVEL && f===MAX_LEVEL && ro===MAX_LEVEL) ? A_FLOWER : 0;
      const cv = (A_CLOVER[c]+A_FMN[f]+A_ROSE[ro]+bonus)*bet;
      if (cv >= A_THRESH) { pd += cv; done = true; }
    }
    if (peak >= 3) c3++;
  }
  return { rtp: pd/wg, avgN: sp/rounds, avgCV: pd/rounds, pct3: c3/rounds, avgTw: tw/rounds };
}

console.log('\n── Tumbleweed-probability sweep (Candidate-A payouts) ───────────────');
console.log('  Probabilities              RTP     avgN  avgCV  ≥3lvl  avgTw');
console.log('  ' + '─'.repeat(70));
for (const t of TW_TESTS) {
  const r = runSimProba(t);
  const flag = Math.abs(r.rtp - 0.95) < 0.025 ? ' ← target' : '';
  console.log(`  ${t.label.padEnd(24)} ${(r.rtp*100).toFixed(2).padStart(6)}% ${r.avgN.toFixed(2).padStart(5)} ${r.avgCV.toFixed(2).padStart(6)} ${(r.pct3*100).toFixed(1).padStart(5)}% ${r.avgTw.toFixed(2).padStart(5)}${flag}`);
}

console.log('\n── Integer-paytable candidates ─────────────────────────────────');
console.log('  Candidate                              RTP     avgN  avgCV  ≥3lvl');
console.log('  ' + '─'.repeat(72));
for (const c of CANDIDATES) {
  const r = runSimInt(c);
  const flag = Math.abs(r.rtp - 0.95) < 0.025 ? ' ← target' : '';
  console.log(`  ${c.label.padEnd(40)} ${(r.rtp*100).toFixed(2).padStart(6)}% ${r.avgN.toFixed(2).padStart(6)} ${r.avgCV.toFixed(2).padStart(6)} ${(r.pct3*100).toFixed(1).padStart(5)}%${flag}`);
}

// ── New-paytable Bot-A (greedy) sweep — target 97.5% RTP ─────────────────────
// Uses the Step-1 paytable with proportionally-scaled probabilities as Tw varies.
// Base non-Tw ratio: C=0.106, F=0.140, R=0.200, GS=0.070 (sum=0.516)

const NP_CLOVER  = [0,  3,  9, 26,  72, 210];
const NP_FMN     = [0,  1,  4, 10,  24,  58];
const NP_ROSE    = [0,  1,  2,  4,   7,  12];
const NP_FLOWER  = 415;
const NP_THRESH  = 5;

function runSimNP(p: ProbaTest, rounds = 400_000): { rtp: number; avgN: number; avgCV: number; pct3: number; pct5: number } {
  const rng  = new RNG(42);
  const resolve = makeResolver(...p.probs);
  const bet = 1;
  let wg = 0, pd = 0, sp = 0, c3 = 0, c5 = 0;
  for (let r = 0; r < rounds; r++) {
    let c=0, f=0, ro=0, peak=0;
    let done = false;
    while (!done) {
      const sym = resolve(rng.next());
      sp++; wg += bet;
      switch (sym) {
        case 'Clover':      c  = clamp(c +1, MAX_LEVEL); break;
        case 'ForgetMeNot': f  = clamp(f +1, MAX_LEVEL); break;
        case 'Rose':        ro = clamp(ro+1, MAX_LEVEL); break;
        case 'GoldenSeed':
          c=clamp(c+1,MAX_LEVEL); f=clamp(f+1,MAX_LEVEL); ro=clamp(ro+1,MAX_LEVEL); break;
        case 'Tumbleweed': c=0; f=0; ro=0; break;
      }
      const p2 = c+f+ro; if (p2 > peak) peak = p2;
      const bonus = (c===MAX_LEVEL && f===MAX_LEVEL && ro===MAX_LEVEL) ? NP_FLOWER : 0;
      const cv = (NP_CLOVER[c]+NP_FMN[f]+NP_ROSE[ro]+bonus)*bet;
      if (cv >= NP_THRESH) { pd += cv; done = true; }
    }
    if (peak >= 3) c3++;
    if (peak >= 5) c5++;
  }
  return { rtp: pd/wg, avgN: sp/rounds, avgCV: pd/rounds, pct3: c3/rounds, pct5: c5/rounds };
}

// Proportional scaling from base non-Tw (C=0.106 F=0.140 R=0.200 GS=0.070 sum=0.516)
const NP_TW_SWEEP: ProbaTest[] = [
  { label: 'Tw=0.412',  probs: [0.121, 0.160, 0.228, 0.079, 0.412] },
  { label: 'Tw=0.411',  probs: [0.121, 0.160, 0.228, 0.080, 0.411] },
  { label: 'Tw=0.410',  probs: [0.121, 0.160, 0.229, 0.080, 0.410] },
  { label: 'Tw=0.409',  probs: [0.121, 0.160, 0.229, 0.081, 0.409] },
  { label: 'Tw=0.408',  probs: [0.121, 0.161, 0.229, 0.081, 0.408] },
];

console.log('\n── New paytable — Bot-A (greedy) Tumbleweed sweep (target 97.5%) ────────');
console.log('  Probabilities              RTP     avgN  avgCV  ≥3lvl  ≥5lvl');
console.log('  ' + '─'.repeat(72));
for (const t of NP_TW_SWEEP) {
  const r = runSimNP(t);
  const flag = Math.abs(r.rtp - 0.975) < 0.025 ? ' ← target' : '';
  console.log(
    `  ${t.label.padEnd(24)} ${(r.rtp*100).toFixed(2).padStart(6)}%` +
    ` ${r.avgN.toFixed(2).padStart(5)} ${r.avgCV.toFixed(2).padStart(6)}` +
    ` ${(r.pct3*100).toFixed(1).padStart(5)}% ${(r.pct5*100).toFixed(1).padStart(5)}%${flag}`,
  );
}

// ── Sweep ────────────────────────────────────────────────────────────────────
// Fine-grained scan around the non-linear phase transition (scale ≈ 5/3 ≈ 1.667)
const scales = [1.50, 1.55, 1.58, 1.60, 1.62, 1.64, 1.66, 1.667, 1.67, 1.70, 1.75, 1.80];
console.log('scale    RTP        avgN     avgCV');
console.log('─'.repeat(50));
for (const s of scales) {
  const r = runSim(s);
  const rtpStr  = (r.rtp  * 100).toFixed(2).padStart(7) + '%';
  const nStr    = r.avgN.toFixed(2).padStart(8);
  const cvStr   = r.avgCV.toFixed(3).padStart(8);
  const flag    = Math.abs(r.rtp - 0.95) < 0.02 ? ' ← near target' : '';
  console.log(`${s.toFixed(3).padEnd(7)}  ${rtpStr}   ${nStr}   ${cvStr}${flag}`);
}
