/**
 * ReelController — state machine that drives the single-reel spin animation.
 *
 * Spin flow
 * ─────────
 *   Idle → BounceUp → SpinUp → Spinning → BounceDown → Settling → Idle
 *
 * The pre-decided target symbol is injected via spin() before the animation
 * begins. No outcome logic lives here — only scroll positions and timing.
 *
 * Usage
 * ─────
 *   const ctrl = new ReelController();
 *   ctrl.spin(reel, config, targetSymbol, restingSymbol, performance.now(), onDone);
 *   // Each frame:
 *   ctrl.update(performance.now(), ticker.deltaMS);
 */
import { type SymbolId } from '../../math/paytable';
import { type ReelConfig } from './ReelConfig';
import { Reel } from './Reel';

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp01(t: number): number { return t < 0 ? 0 : t > 1 ? 1 : t; }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function easeIn(t: number): number { return t * t; }
function easeOut(t: number): number { return 1 - (1 - t) ** 2; }
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

// ── Phase type ───────────────────────────────────────────────────────────────

type Phase =
  | 'idle'
  | 'bounceUp'
  | 'spinUp'
  | 'spinning'
  | 'bounceDown'
  | 'settling';

// ── ReelController ───────────────────────────────────────────────────────────

export class ReelController {
  private phase: Phase = 'idle';

  private reel!: Reel;
  private cfg!: ReelConfig;
  private target!: SymbolId;
  private onDone: (() => void) | null = null;

  // Per-phase tween state
  private phaseStartMs  = 0;
  private phaseFromScroll = 0;
  private phaseToScroll   = 0;

  // ── Public ──────────────────────────────────────────────────────────────────

  /**
   * Begin a spin to the pre-decided target symbol.
   *
   * @param reel           The Reel instance to animate.
   * @param cfg            Tuning config (from DEFAULT_REEL_CONFIG or custom).
   * @param target         Pre-decided outcome symbol — injected before animation.
   * @param restingSymbol  Symbol currently shown (for seamless BounceUp).
   * @param nowMs          Current timestamp (performance.now()).
   * @param onDone         Called once the reel has fully settled on the target.
   */
  spin(
    reel: Reel,
    cfg: ReelConfig,
    target: SymbolId,
    restingSymbol: SymbolId | null,
    nowMs: number,
    onDone: () => void,
  ): void {
    this.reel    = reel;
    this.cfg     = cfg;
    this.target  = target;
    this.onDone  = onDone;

    reel.buildTape(target, cfg.spinning.minScreens, restingSymbol);
    this.enterBounceUp(nowMs);
  }

  /**
   * Advance the animation by one frame.
   * Call every frame while a spin is in progress.
   *
   * @param nowMs  Current timestamp (performance.now()).
   * @param dtMs   Milliseconds since last frame (ticker.deltaMS).
   */
  update(nowMs: number, dtMs: number): void {
    switch (this.phase) {
      case 'bounceUp':   this.tickBounceUp(nowMs);         break;
      case 'spinUp':     this.tickSpinUp(nowMs, dtMs);     break;
      case 'spinning':   this.tickSpinning(nowMs, dtMs);   break;
      case 'bounceDown': this.tickBounceDown(nowMs);       break;
      case 'settling':   this.tickSettling(nowMs);         break;
    }
  }

  /** Immediately cancel any in-progress spin (used by reset). */
  stop(): void {
    this.phase  = 'idle';
    this.onDone = null;
  }

  get isActive(): boolean { return this.phase !== 'idle'; }

  // ── Phase transitions ────────────────────────────────────────────────────────

  private enterBounceUp(nowMs: number): void {
    this.phase         = 'bounceUp';
    this.phaseStartMs  = nowMs;
    this.phaseFromScroll = 0;
    // scrollY going negative = strip bounces DOWN (opposite to spin direction)
    // — gives a "winding up" feel before the upward spin launches.
    this.phaseToScroll = -this.cfg.bounceUp.amount;
    this.reel.setBlurAlpha(0);
  }

  private tickBounceUp(nowMs: number): void {
    const t = clamp01((nowMs - this.phaseStartMs) / this.cfg.bounceUp.duration);
    this.reel.setScrollY(lerp(this.phaseFromScroll, this.phaseToScroll, easeOut(t)));
    if (t >= 1) this.enterSpinUp(nowMs);
  }

  // ─────────────────────────────────────────────────────────────────────────────

  private enterSpinUp(nowMs: number): void {
    this.phase           = 'spinUp';
    this.phaseStartMs    = nowMs;
    this.phaseFromScroll = this.reel.scrollY; // = -bounceUp.amount
    this.reel.setBlurAlpha(this.cfg.blurAlpha * 0.4);
  }

  private tickSpinUp(nowMs: number, dtMs: number): void {
    const t = clamp01((nowMs - this.phaseStartMs) / this.cfg.spinUp.duration);
    // Velocity ramps from 0 to full spin speed (px/ms).
    const v = lerp(0, this.cfg.spinning.speed / 1000, easeIn(t));
    this.reel.setScrollY(this.reel.scrollY + v * dtMs);
    this.reel.setBlurAlpha(lerp(this.cfg.blurAlpha * 0.4, this.cfg.blurAlpha, t));
    if (t >= 1) {
      this.phase = 'spinning';
      this.reel.setBlurAlpha(this.cfg.blurAlpha);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  private tickSpinning(nowMs: number, dtMs: number): void {
    const v       = this.cfg.spinning.speed / 1000; // px/ms
    const newScrollY = this.reel.scrollY + v * dtMs;

    // Trigger BounceDown once the strip is one overshoot away from the target.
    // At the trigger point, tape[tapeLen-2] is visible — one cell before the target.
    const triggerY = this.reel.finalScrollY - this.cfg.bounceDown.amount;

    if (newScrollY >= triggerY) {
      this.reel.setScrollY(triggerY);
      this.enterBounceDown(nowMs);
    } else {
      this.reel.setScrollY(newScrollY);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  private enterBounceDown(nowMs: number): void {
    this.phase           = 'bounceDown';
    this.phaseStartMs    = nowMs;
    this.phaseFromScroll = this.reel.scrollY; // = finalScrollY - overshoot
    // Overshoot past the target so the reel "lands with weight".
    this.phaseToScroll   = this.reel.finalScrollY + this.cfg.bounceDown.amount;
  }

  private tickBounceDown(nowMs: number): void {
    const t = clamp01((nowMs - this.phaseStartMs) / this.cfg.bounceDown.duration);
    this.reel.setScrollY(lerp(this.phaseFromScroll, this.phaseToScroll, easeOut(t)));
    // Fade blur as the reel decelerates.
    this.reel.setBlurAlpha(this.cfg.blurAlpha * (1 - t) * 0.6);
    if (t >= 1) this.enterSettling(nowMs);
  }

  // ─────────────────────────────────────────────────────────────────────────────

  private enterSettling(nowMs: number): void {
    this.phase           = 'settling';
    this.phaseStartMs    = nowMs;
    this.phaseFromScroll = this.reel.scrollY; // = finalScrollY + overshoot
    this.phaseToScroll   = this.reel.finalScrollY;
    this.reel.setBlurAlpha(0);
  }

  private tickSettling(nowMs: number): void {
    const t = clamp01((nowMs - this.phaseStartMs) / this.cfg.settling.duration);
    this.reel.setScrollY(lerp(this.phaseFromScroll, this.phaseToScroll, easeInOut(t)));
    if (t >= 1) {
      // Snap to exact position and show final styled cell.
      this.reel.setScrollY(this.phaseToScroll);
      this.reel.showFinal(this.target);
      this.phase = 'idle';
      const cb = this.onDone;
      this.onDone = null;
      cb?.();
    }
  }
}
