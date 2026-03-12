/**
 * Reel — single-reel visual strip with symbol buffer and scroll management.
 *
 * Layout
 * ──────
 *   ABOVE buffer cells  (above visible viewport, provide entering symbols)
 *   ── viewport mask begins ──
 *   1 visible cell
 *   ── viewport mask ends ──
 *   BELOW buffer cells  (symbols that have just left the viewport)
 *
 * Scroll direction
 * ────────────────
 *   scrollY = 0     → resting; tape[0] is visible.
 *   scrollY increases → strip moves UPWARD; new symbols enter from below.
 *   finalScrollY = (tapeLen - 1) * cellH → target symbol is centred.
 *
 * Symbol tape
 * ───────────
 *   Pre-generated once per spin in buildTape():
 *     tape[0]            = resting / first-visible symbol
 *     tape[1 … N-2]      = filler symbols shown while spinning
 *     tape[N-1]          = pre-decided target symbol
 *
 *   The tape is fixed; no random choices happen after buildTape().
 */
import * as PIXI from 'pixi.js';
import { type SymbolId } from '../../math/paytable';

// ── Constants ────────────────────────────────────────────────────────────────

const SYMBOL_EMOJI: Record<SymbolId, string> = {
  Clover:      '🍀',
  ForgetMeNot: '💙',
  Rose:        '🌹',
  GoldenSeed:  '✨',
  Empty:       '',   // never rendered as a centered symbol
  Tumbleweed:  '💨',
};

const SYMBOL_COLOR: Record<SymbolId, number> = {
  Clover:      0x2ecc71,
  ForgetMeNot: 0x3498db,
  Rose:        0xe74c3c,
  GoldenSeed:  0xf1c40f,
  Empty:       0x10101e,  // never used — gap stop is visual
  Tumbleweed:  0x95a5a6,
};

/** Cycling pool used to fill non-target positions in the tape. */
const FILLER: readonly SymbolId[] = [
  'Clover', 'ForgetMeNot', 'Rose', 'GoldenSeed', 'Tumbleweed',
];

/** Buffer cells above and below the single visible cell. */
const ABOVE = 2;
const BELOW = 2;

// ── CellDisplay ──────────────────────────────────────────────────────────────

/**
 * One cell in the strip — background card + emoji + name label.
 * Rendered in three visual modes: blank (idle), spinning, final.
 */
class CellDisplay {
  readonly container: PIXI.Container;
  private readonly bg: PIXI.Graphics;
  private readonly emoji: PIXI.Text;
  private readonly label: PIXI.Text;
  private readonly cellH: number;

  constructor(cellH: number) {
    this.cellH = cellH;
    this.container = new PIXI.Container();

    this.bg = new PIXI.Graphics();
    this.drawBg(0x10101e, 0x24244a, 1.5);
    this.container.addChild(this.bg);

    const emojiFontSize = Math.round(cellH * 0.38);
    this.emoji = new PIXI.Text({
      text: '',
      style: { fontSize: emojiFontSize, fill: 0x6666aa, align: 'center' },
    });
    this.emoji.anchor.set(0.5);
    this.emoji.position.set(cellH / 2, cellH / 2 - Math.round(cellH * 0.07));
    this.container.addChild(this.emoji);

    const labelFontSize = Math.max(11, Math.round(cellH * 0.065));
    this.label = new PIXI.Text({
      text: '',
      style: {
        fontSize: labelFontSize,
        fill: 0x888899,
        align: 'center',
        fontFamily: 'Arial',
        letterSpacing: 1,
      },
    });
    this.label.anchor.set(0.5);
    this.label.position.set(cellH / 2, cellH - Math.round(cellH * 0.1));
    this.container.addChild(this.label);
  }

  private drawBg(fill: number, stroke: number, strokeW: number): void {
    this.bg.clear()
      .roundRect(2, 2, this.cellH - 4, this.cellH - 4, 12)
      .fill({ color: fill })
      .stroke({ width: strokeW, color: stroke });
  }

  /** Filler / pre-spin display: dimmed emoji, no label, neutral border. */
  setSpinning(sym: SymbolId): void {
    this.emoji.text = SYMBOL_EMOJI[sym];
    this.emoji.style.fill = 0x6666aa;
    this.label.text = '';
    this.drawBg(0x10101e, 0x24244a, 1.5);
  }

  /** Settled display: bright emoji, coloured border, name label. */
  setFinal(sym: SymbolId): void {
    const c = SYMBOL_COLOR[sym];
    this.emoji.text = SYMBOL_EMOJI[sym];
    this.emoji.style.fill = 0xffffff;
    this.label.text = sym === 'ForgetMeNot' ? 'FORGET-ME-NOT' : sym.toUpperCase();
    this.label.style.fill = c;
    this.drawBg(0x0d0d1f, c, 3);
  }

  /** Blank / reset state shown before the first spin. */
  setBlank(): void {
    this.emoji.text = '?';
    this.emoji.style.fill = 0x555577;
    this.label.text = '';
    this.drawBg(0x12122a, 0x2a2a50, 2);
  }
}

// ── Reel ─────────────────────────────────────────────────────────────────────

export class Reel {
  /** Masked viewport container — position this on stage. */
  readonly viewport: PIXI.Container;

  private readonly strip: PIXI.Container;
  private readonly blurOverlay: PIXI.Graphics;
  private cells: CellDisplay[] = [];

  /** Height of one cell (= the visible square size). */
  readonly cellH: number;

  private _scrollY = 0;
  private _tapeLen = 1;
  /**
   * Extra fractional offset added to finalScrollY for EMPTY results.
   * 0 = normal centred stop.  cellH/2 = stops between two cells (gap look).
   */
  private _finalScrollOffset = 0;

  constructor(cellH: number) {
    this.cellH = cellH;

    this.viewport = new PIXI.Container();

    // Mask — clips the scrolling strip to one cell's bounds.
    const mask = new PIXI.Graphics()
      .rect(0, 0, cellH, cellH)
      .fill({ color: 0xffffff });
    this.viewport.addChild(mask);
    this.viewport.mask = mask;

    this.strip = new PIXI.Container();
    this.viewport.addChild(this.strip);

    // Blur overlay sits above the strip, inside the mask.
    this.blurOverlay = new PIXI.Graphics()
      .rect(0, 0, cellH, cellH)
      .fill({ color: 0x000000 });
    this.blurOverlay.alpha = 0;
    this.viewport.addChild(this.blurOverlay);

    this.buildIdleCell();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Total pixels to scroll to reach the final stop position.
   * For normal symbols: target cell is centred in the viewport.
   * For EMPTY: an extra cellH/2 offset stops the reel between two cells,
   * showing the bottom-half of one symbol and the top-half of the next.
   */
  get finalScrollY(): number {
    return (this._tapeLen - 1) * this.cellH + this._finalScrollOffset;
  }

  get scrollY(): number { return this._scrollY; }

  /**
   * Set the current scroll position.
   * strip.y = -(ABOVE + tapeLen - 1)*cellH + scrollY
   * → at scrollY=0 cell[ABOVE + tapeLen - 1] (resting) is at viewport y=0.
   * → scrollY increasing moves strip downward (symbols scroll down; new enter from above).
   */
  setScrollY(y: number): void {
    this._scrollY = y;
    this.strip.y = -(ABOVE + this._tapeLen - 1) * this.cellH + y;
  }

  /**
   * Build the symbol strip for an upcoming spin.
   *
   * @param target       The pre-decided outcome symbol.
   * @param minScreens   Minimum cells to scroll (controls spin length).
   * @param restingSymbol  Symbol currently displayed (for seamless BounceUp).
   */
  buildTape(
    target: SymbolId,
    minScreens: number,
    restingSymbol: SymbolId | null,
  ): void {
    this.strip.removeChildren();
    this.cells = [];

    // ── Build the symbol tape ──────────────────────────────────────────────
    // tape[0]        = target (visible at finalScrollY — top of tape)
    // tape[1..N-2]   = cycling fillers shown while spinning
    // tape[N-1]      = resting (visible at scrollY=0 — bottom of tape)
    this._tapeLen = minScreens + 2; // at least minScreens filler + target

    // EMPTY result: stop between two cells (cellH/2 offset past tape[0]).
    // tape[0] is a filler — the gap is created by the stop position, not the cell.
    // Normal result: stop exactly on tape[0].
    this._finalScrollOffset = target === 'Empty' ? this.cellH / 2 : 0;
    const tapeTarget: SymbolId = target === 'Empty' ? FILLER[0] : target;

    const tape: SymbolId[] = [];

    // Resting symbol must be a real renderable symbol (not Empty).
    const resting = (restingSymbol === 'Empty' || restingSymbol === null)
      ? FILLER[0]
      : restingSymbol;
    tape.push(tapeTarget); // tape[0]

    for (let i = 1; i < this._tapeLen - 1; i++) {
      tape.push(FILLER[i % FILLER.length]);
    }
    tape.push(resting); // tape[last]

    // ── Build cells ────────────────────────────────────────────────────────
    const totalCells = ABOVE + this._tapeLen + BELOW;

    for (let j = 0; j < totalCells; j++) {
      const cell = new CellDisplay(this.cellH);
      cell.container.y = j * this.cellH;

      if (j < ABOVE) {
        // Above-buffer: shown only at extreme overshoot (tiny portion); use filler.
        cell.setSpinning(FILLER[j % FILLER.length]);
      } else if (j < ABOVE + this._tapeLen) {
        cell.setSpinning(tape[j - ABOVE]);
      } else {
        // Below-buffer: peeks in during BounceUp — fill with resting for seamless look.
        cell.setSpinning(resting);
      }

      this.strip.addChild(cell.container);
      this.cells.push(cell);
    }

    this._scrollY = 0;
    this.strip.y = -(ABOVE + this._tapeLen - 1) * this.cellH;
  }

  /**
   * Apply final (settled) visual to the target cell.
   * Call after the settling phase completes.
   * For EMPTY the reel rests between two half-visible cells — no cell to highlight.
   */
  showFinal(sym: SymbolId): void {
    if (sym === 'Empty') return; // gap stop — both half-cells stay in spinning state
    const targetIdx = ABOVE; // tape[0] = cell[ABOVE], visible at finalScrollY
    if (targetIdx < this.cells.length) {
      this.cells[targetIdx].setFinal(sym);
    }
  }

  /** Set alpha of the motion-blur overlay (0 = none). */
  setBlurAlpha(a: number): void {
    this.blurOverlay.alpha = Math.max(0, Math.min(1, a));
  }

  /** Clear the strip and show blank "?" idle state. */
  reset(): void {
    this.blurOverlay.alpha = 0;
    this.buildIdleCell();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private buildIdleCell(): void {
    this.strip.removeChildren();
    this.cells = [];
    this._tapeLen = 1;
    this._finalScrollOffset = 0;
    const cell = new CellDisplay(this.cellH);
    cell.container.y = 0;
    cell.setBlank();
    this.strip.addChild(cell.container);
    this.cells.push(cell);
    this._scrollY = 0;
    this.strip.y = 0;
  }
}
