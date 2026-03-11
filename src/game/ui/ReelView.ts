/**
 * ReelView — single centered reel card, sized by layout.
 *
 * Animation only presents the pre-decided symbol; it does NOT determine outcome.
 */
import * as PIXI from 'pixi.js';
import { type SymbolId } from '../math/paytable';

const SYMBOL_ORDER: SymbolId[] = ['Clover', 'ForgetMeNot', 'Rose', 'GoldenSeed', 'Tumbleweed'];

const SYMBOL_EMOJI: Record<SymbolId, string> = {
  Clover:      '🍀',
  ForgetMeNot: '💙',
  Rose:        '🌹',
  GoldenSeed:  '✨',
  Tumbleweed:  '💨',
};

const SYMBOL_COLOR: Record<SymbolId, number> = {
  Clover:      0x2ecc71,
  ForgetMeNot: 0x3498db,
  Rose:        0xe74c3c,
  GoldenSeed:  0xf1c40f,
  Tumbleweed:  0x95a5a6,
};

const SPIN_DURATION_MS = 800;

export class ReelView {
  readonly container: PIXI.Container;
  private size: number;
  private bg: PIXI.Graphics;
  private symbolText: PIXI.Text;
  private labelText: PIXI.Text;
  private spinTween: number | null = null;
  private _spinning = false;

  constructor(size: number) {
    this.size = size;
    this.container = new PIXI.Container();

    this.bg = new PIXI.Graphics();
    this.drawBg(0x12122a, 0x2a2a50, 2);
    this.container.addChild(this.bg);

    const emojiFontSize = Math.round(size * 0.38);
    this.symbolText = new PIXI.Text({
      text: '?',
      style: {
        fontSize: emojiFontSize,
        fill: 0x555577,
        align: 'center',
      },
    });
    this.symbolText.anchor.set(0.5);
    this.symbolText.position.set(size / 2, size / 2 - Math.round(size * 0.07));
    this.container.addChild(this.symbolText);

    const labelFontSize = Math.max(12, Math.round(size * 0.065));
    this.labelText = new PIXI.Text({
      text: '',
      style: {
        fontSize: labelFontSize,
        fill: 0x888899,
        align: 'center',
        fontFamily: 'Arial',
        letterSpacing: 1,
      },
    });
    this.labelText.anchor.set(0.5);
    this.labelText.position.set(size / 2, size - Math.round(size * 0.1));
    this.container.addChild(this.labelText);
  }

  private drawBg(fillColor: number, strokeColor: number, strokeW: number): void {
    this.bg.clear();
    this.bg
      .roundRect(0, 0, this.size, this.size, 16)
      .fill({ color: fillColor })
      .stroke({ width: strokeW, color: strokeColor });
  }

  get spinning(): boolean { return this._spinning; }

  /**
   * Animate reel to the pre-decided symbol. Returns a Promise when done.
   * The symbol was resolved BEFORE this call — animation is purely cosmetic.
   */
  spinTo(symbol: SymbolId): Promise<void> {
    if (this._spinning) return Promise.resolve();
    this._spinning = true;

    return new Promise((resolve) => {
      const startTime = performance.now();
      const syms = SYMBOL_ORDER;
      let frame = 0;

      const tick = () => {
        const elapsed = performance.now() - startTime;

        if (elapsed < SPIN_DURATION_MS - 240) {
          this.showSymbol(syms[frame % syms.length], false);
          frame++;
          this.spinTween = window.setTimeout(tick, 75);
        } else if (elapsed < SPIN_DURATION_MS) {
          // Slow down: briefly show a neighbour for tactile feel
          const targetIdx = syms.indexOf(symbol);
          this.showSymbol(syms[(targetIdx + 1) % syms.length], false);
          this.spinTween = window.setTimeout(tick, 160);
        } else {
          this.showSymbol(symbol, true);
          this._spinning = false;
          this.spinTween = null;
          resolve();
        }
      };

      this.spinTween = window.setTimeout(tick, 0);
    });
  }

  private showSymbol(symbol: SymbolId, final: boolean): void {
    this.symbolText.text = SYMBOL_EMOJI[symbol];

    if (final) {
      const c = SYMBOL_COLOR[symbol];
      this.symbolText.style.fill = 0xffffff;
      this.labelText.text = symbol.toUpperCase();
      this.labelText.style.fill = c;
      this.drawBg(0x0d0d1f, c, 3);
    } else {
      this.symbolText.style.fill = 0x7777aa;
      this.labelText.text = '';
      this.drawBg(0x12122a, 0x2a2a50, 2);
    }
  }

  /** Flash reel border for emphasis (special symbol feedback). */
  pulse(color: number): void {
    let toggle = false;
    let count = 0;
    const id = setInterval(() => {
      this.drawBg(0x0d0d1f, toggle ? color : 0xffffff, 4);
      toggle = !toggle;
      if (++count >= 6) clearInterval(id);
    }, 80);
  }

  /** Full reset — clears all temp visuals. */
  reset(): void {
    if (this.spinTween !== null) {
      clearTimeout(this.spinTween);
      this.spinTween = null;
    }
    this._spinning = false;
    this.symbolText.text = '?';
    this.symbolText.style.fill = 0x555577;
    this.labelText.text = '';
    this.drawBg(0x12122a, 0x2a2a50, 2);
  }
}
