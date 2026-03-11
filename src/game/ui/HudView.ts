/**
 * HudView — full-width footer panel.
 *
 * Layout (top-to-bottom inside the container, which Game places at footer.y):
 *   ─ divider line
 *   ─ 3 stat cells  (Balance / Bet / Collect Value)
 *   ─ status / flower-bonus message
 *   ─ SPIN + COLLECT buttons
 *
 * Collect button disabled unless collectValue >= 2 × bet (rule from OutcomeController).
 * Input double-trigger blocked by _gestureConsumed flag.
 */
import * as PIXI from 'pixi.js';
import { type FooterCfg } from './LayoutManager';

export interface HudCallbacks {
  onSpin: () => void;
  onCollect: () => void;
}

// ─── Colour palette ──────────────────────────────────────────────────────────
const COL_PANEL_BG           = 0x0c0c20;
const COL_DIVIDER            = 0x2a2a50;
const COL_LABEL              = 0x666688;
const COL_VALUE              = 0xdde0ff;
const COL_VALUE_GREEN        = 0x2ecc71;
const COL_VALUE_MUTED        = 0x555577;
const COL_SPIN_ON            = 0x1a9e52;
const COL_SPIN_OFF           = 0x1e1e36;
const COL_SPIN_STROKE_ON     = 0x2ecc71;
const COL_SPIN_STROKE_OFF    = 0x333355;
const COL_COLLECT_ON         = 0x1260a0;
const COL_COLLECT_OFF        = 0x1e1e36;
const COL_COLLECT_STROKE_ON  = 0x3498db;
const COL_COLLECT_STROKE_OFF = 0x333355;
// ─────────────────────────────────────────────────────────────────────────────

export class HudView {
  readonly container: PIXI.Container;

  private balValueText: PIXI.Text;
  private collectValueText: PIXI.Text;
  private statusText: PIXI.Text;

  private spinBtn: PIXI.Container;
  private collectBtn: PIXI.Container;
  private spinBg: PIXI.Graphics;
  private collectBg: PIXI.Graphics;

  private _spinEnabled     = true;
  private _collectEnabled  = false;
  private _gestureConsumed = false;

  private cfg: FooterCfg;

  constructor(stageW: number, cfg: FooterCfg, callbacks: HudCallbacks) {
    this.cfg = cfg;
    this.container = new PIXI.Container();

    const { h, statLabelSize, statValueSize, statusFontSize } = cfg;

    // Panel background
    const panel = new PIXI.Graphics();
    panel.rect(0, 0, stageW, h).fill({ color: COL_PANEL_BG });
    this.container.addChild(panel);

    // Top divider
    const div = new PIXI.Graphics();
    div.rect(0, 0, stageW, 1).fill({ color: COL_DIVIDER });
    this.container.addChild(div);

    // Stat cells — 3 evenly spaced across full width
    const cellCenters = [stageW / 6, stageW / 2, (5 * stageW) / 6];
    const statLabels  = ['BALANCE', 'BET', 'COLLECT VALUE'];
    const statInitial = ['100.0 FUN', '1 FUN', '0.0 FUN'];
    const initColors  = [COL_VALUE, COL_VALUE, COL_VALUE_MUTED];

    const labelY = 14;
    const valueY = labelY + statLabelSize + 6;

    const valueTexts: PIXI.Text[] = [];
    for (let i = 0; i < 3; i++) {
      const lbl = new PIXI.Text({
        text: statLabels[i],
        style: {
          fontSize: statLabelSize,
          fill: COL_LABEL,
          fontFamily: 'Arial',
          align: 'center',
        },
      });
      lbl.anchor.set(0.5, 0);
      lbl.position.set(cellCenters[i], labelY);
      this.container.addChild(lbl);

      const val = new PIXI.Text({
        text: statInitial[i],
        style: {
          fontSize: statValueSize,
          fill: initColors[i],
          fontFamily: 'Arial',
          fontWeight: 'bold',
          align: 'center',
        },
      });
      val.anchor.set(0.5, 0);
      val.position.set(cellCenters[i], valueY);
      this.container.addChild(val);
      valueTexts.push(val);
    }

    this.balValueText     = valueTexts[0];
    // valueTexts[1] = bet value (static in prototype)
    this.collectValueText = valueTexts[2];

    // Status / flower-bonus line
    const statusY = valueY + statValueSize + 10;
    this.statusText = new PIXI.Text({
      text: '',
      style: {
        fontSize: statusFontSize,
        fill: 0xf39c12,
        fontFamily: 'Arial',
        align: 'center',
      },
    });
    this.statusText.anchor.set(0.5, 0);
    this.statusText.position.set(stageW / 2, statusY);
    this.container.addChild(this.statusText);

    // Buttons — below the status text, also never closer than `pad` from the footer bottom.
    // Math.max ensures buttons never overlap the status line regardless of footer height.
    const { btnW, btnH, btnFontSize, btnGap, pad } = cfg;
    const totalBtnW  = btnW * 2 + btnGap;
    const btnStartX  = (stageW - totalBtnW) / 2;
    const statusClearY = statusY + statusFontSize + 8;   // first safe y after status text
    const btnY         = Math.max(h - btnH - pad, statusClearY);

    const [spinBtn, spinBg] = this.makeButton(
      'SPIN', COL_SPIN_ON, COL_SPIN_STROKE_ON, btnW, btnH, btnFontSize,
      () => {
        if (!this._spinEnabled || this._gestureConsumed) return;
        this._gestureConsumed = true;
        callbacks.onSpin();
      },
    );
    this.spinBtn = spinBtn;
    this.spinBg  = spinBg;
    spinBtn.position.set(btnStartX, btnY);
    this.container.addChild(spinBtn);

    const [collectBtn, collectBg] = this.makeButton(
      'COLLECT', COL_COLLECT_ON, COL_COLLECT_STROKE_ON, btnW, btnH, btnFontSize,
      () => {
        if (!this._collectEnabled || this._gestureConsumed) return;
        this._gestureConsumed = true;
        callbacks.onCollect();
      },
    );
    this.collectBtn = collectBtn;
    this.collectBg  = collectBg;
    collectBtn.position.set(btnStartX + btnW + btnGap, btnY);
    this.container.addChild(collectBtn);

    this.applySpinState(true);
    this.applyCollectState(false);
  }

  // ── Button factory ──────────────────────────────────────────────────────────

  private makeButton(
    label: string,
    fillColor: number, strokeColor: number,
    w: number, h: number, fontSize: number,
    onClick: () => void,
  ): [PIXI.Container, PIXI.Graphics] {
    const c = new PIXI.Container();
    c.interactive = true;
    c.cursor = 'pointer';

    const bg = new PIXI.Graphics();
    this.drawBtnBg(bg, fillColor, strokeColor, w, h);
    c.addChild(bg);

    const txt = new PIXI.Text({
      text: label,
      style: {
        fontSize,
        fill: 0xffffff,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        align: 'center',
        letterSpacing: 1,
      },
    });
    txt.anchor.set(0.5);
    txt.position.set(w / 2, h / 2);
    c.addChild(txt);

    // Hover / press feedback (desktop + mobile tap)
    c.on('pointerover',      () => { if (c.interactive) c.scale.set(1.04); });
    c.on('pointerout',       () => { c.scale.set(1.0); });
    c.on('pointerdown',      () => { if (c.interactive) { c.scale.set(0.96); onClick(); } });
    c.on('pointerup',        () => { c.scale.set(1.0); });
    c.on('pointerupoutside', () => { c.scale.set(1.0); });

    return [c, bg];
  }

  private drawBtnBg(
    g: PIXI.Graphics,
    fill: number, stroke: number,
    w: number, h: number,
  ): void {
    g.clear();
    g.roundRect(0, 0, w, h, 12)
      .fill({ color: fill })
      .stroke({ width: 2, color: stroke });
  }

  // ── State management ────────────────────────────────────────────────────────

  private applySpinState(enabled: boolean): void {
    this._spinEnabled = enabled;
    const { btnW, btnH } = this.cfg;
    this.drawBtnBg(
      this.spinBg,
      enabled ? COL_SPIN_ON : COL_SPIN_OFF,
      enabled ? COL_SPIN_STROKE_ON : COL_SPIN_STROKE_OFF,
      btnW, btnH,
    );
    this.spinBtn.alpha       = enabled ? 1.0 : 0.45;
    this.spinBtn.interactive = enabled;
    this.spinBtn.cursor      = enabled ? 'pointer' : 'default';
  }

  private applyCollectState(enabled: boolean): void {
    this._collectEnabled = enabled;
    const { btnW, btnH } = this.cfg;
    this.drawBtnBg(
      this.collectBg,
      enabled ? COL_COLLECT_ON : COL_COLLECT_OFF,
      enabled ? COL_COLLECT_STROKE_ON : COL_COLLECT_STROKE_OFF,
      btnW, btnH,
    );
    this.collectBtn.alpha       = enabled ? 1.0 : 0.40;
    this.collectBtn.interactive = enabled;
    this.collectBtn.cursor      = enabled ? 'pointer' : 'default';
  }

  // ── Public API (original contract preserved) ────────────────────────────────

  setBalance(balance: number): void {
    this.balValueText.text = `${balance.toFixed(1)} FUN`;
  }

  setBet(_bet: number): void {
    // Bet display is static in this prototype.
    // Hook preserved for a future bet-selector.
  }

  setCollectValue(value: number, enabled: boolean): void {
    this.collectValueText.text       = `${value.toFixed(1)} FUN`;
    this.collectValueText.style.fill = enabled ? COL_VALUE_GREEN : COL_VALUE_MUTED;
    this.applyCollectState(enabled);
  }

  setSpinEnabled(enabled: boolean): void {
    this.applySpinState(enabled);
  }

  setStatus(msg: string, color = 0xf39c12): void {
    this.statusText.text       = msg;
    this.statusText.style.fill = color;
  }

  setFlowerBonus(active: boolean): void {
    if (active) {
      this.statusText.text       = '🌸  FLOWER BONUS  +500  🌸';
      this.statusText.style.fill = 0xf1c40f;
    } else if ((this.statusText.text as string).includes('FLOWER')) {
      this.statusText.text = '';
    }
  }

  /** Re-arm the single-fire guard before the next spin or collect. */
  releaseGesture(): void {
    this._gestureConsumed = false;
  }

  /** Full reset — clear all temp text, disable collect, re-arm gesture. */
  reset(): void {
    this.setStatus('');
    this.setCollectValue(0, false);
    this.releaseGesture();
  }
}
