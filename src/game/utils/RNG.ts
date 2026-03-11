/**
 * Deterministic seeded RNG using Mulberry32 algorithm.
 * Outcome is decided BEFORE animation – the RNG is advanced once per spin.
 */
export class RNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Return current state (for serialization) */
  getState(): number {
    return this.state;
  }
}

/** Generate a random 32-bit seed */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
