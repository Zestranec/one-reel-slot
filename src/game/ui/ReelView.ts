/**
 * ReelView — single reel card with fully animated strip.
 *
 * External API is unchanged from the previous version:
 *   spinTo(symbol)   → Promise<void>
 *   pulse(color)     → void
 *   reset()          → void
 *   spinning         → boolean (getter)
 *   container        → PIXI.Container
 *
 * Internally delegates to Reel (strip + scroll) and ReelController (state machine).
 *
 * Outcome is always decided BEFORE spinTo() is called.
 * The animation only presents the pre-decided symbol — no outcome logic here.
 */
import * as PIXI from 'pixi.js';
import { type SymbolId } from '../math/paytable';
import { Reel } from './reel/Reel';
import { ReelController } from './reel/ReelController';
import { DEFAULT_REEL_CONFIG } from './reel/ReelConfig';

export class ReelView {
  readonly container: PIXI.Container;

  private readonly outerBg: PIXI.Graphics;
  private readonly reel: Reel;
  private readonly ctrl: ReelController;
  private readonly tickFn: (t: PIXI.Ticker) => void;

  private _spinning = false;
  private lastSymbol: SymbolId | null = null;
  private readonly size: number;

  constructor(size: number) {
    this.size = size;
    this.container = new PIXI.Container();

    // Outer card border — visible around the inner reel strip.
    this.outerBg = new PIXI.Graphics();
    this.drawOuterBg(0x12122a, 0x2a2a50, 2);
    this.container.addChild(this.outerBg);

    // Reel strip — occupies the same size×size area (cells are inset by 2px).
    this.reel = new Reel(size);
    this.container.addChild(this.reel.viewport);

    this.ctrl = new ReelController();

    // Use the shared PIXI ticker so we integrate with the existing app loop.
    // The handler is guarded by _spinning so it never runs outside a spin.
    this.tickFn = (ticker: PIXI.Ticker) => {
      if (this._spinning) {
        this.ctrl.update(performance.now(), ticker.deltaMS);
      }
    };
    PIXI.Ticker.shared.add(this.tickFn);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  get spinning(): boolean { return this._spinning; }

  /**
   * Animate the reel to the pre-decided symbol.
   * Returns a Promise that resolves once the reel has fully settled.
   *
   * The symbol MUST be resolved by the caller before this is invoked —
   * this method only presents it visually.
   */
  spinTo(symbol: SymbolId): Promise<void> {
    if (this._spinning) return Promise.resolve();
    this._spinning = true;

    return new Promise<void>((resolve) => {
      this.ctrl.spin(
        this.reel,
        DEFAULT_REEL_CONFIG,
        symbol,
        this.lastSymbol,
        performance.now(),
        () => {
          this.lastSymbol = symbol;
          this._spinning  = false;
          resolve();
        },
      );
    });
  }

  /**
   * Flash the card border for emphasis (called after special symbol feedback).
   * Does not interfere with the reel strip animation.
   * Restores idle border state once the animation completes.
   */
  pulse(color: number): void {
    let toggle = false;
    let count  = 0;
    const id = setInterval(() => {
      this.drawOuterBg(0x0d0d1f, toggle ? color : 0xffffff, 4);
      toggle = !toggle;
      if (++count >= 6) {
        clearInterval(id);
        this.drawOuterBg(0x12122a, 0x2a2a50, 2); // restore idle border
      }
    }, 80);
  }

  /**
   * Full reset — stops any in-progress animation and returns to blank state.
   * Called on Collect or layout rebuild.
   */
  reset(): void {
    this.ctrl.stop();
    this._spinning  = false;
    this.lastSymbol = null;
    this.reel.reset();
    this.drawOuterBg(0x12122a, 0x2a2a50, 2);
  }

  /**
   * Remove the ticker handler.
   * Call when this view is being discarded (e.g., layout rebuild in Game.ts).
   */
  destroy(): void {
    PIXI.Ticker.shared.remove(this.tickFn);
    this.ctrl.stop();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private drawOuterBg(fill: number, stroke: number, strokeW: number): void {
    this.outerBg.clear()
      .roundRect(0, 0, this.size, this.size, 16)
      .fill({ color: fill })
      .stroke({ width: strokeW, color: stroke });
  }
}
