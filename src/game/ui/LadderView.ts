/**
 * LadderView — visual progress card for a single ladder (levels 0–5).
 *
 * Sized and positioned entirely from LadderLayoutCfg.
 * All game methods (setLevel, flashWipe, flashFlowerBonus, reset) preserved.
 */
import * as PIXI from 'pixi.js';
import { MAX_LEVEL } from '../math/paytable';
import { type LadderLayoutCfg } from './LayoutManager';

/** Padding above the title text inside the card. */
const TITLE_PAD_TOP = 10;
/** Gap between title baseline and first step. */
const TITLE_GAP = 6;
/** Padding below the last step before the level counter. */
const LEVEL_PAD = 6;

export class LadderView {
  readonly container: PIXI.Container;
  private steps: PIXI.Graphics[] = [];
  private stepLabels: PIXI.Text[] = [];
  private titleText: PIXI.Text;
  private levelText: PIXI.Text;
  private cardBg: PIXI.Graphics;
  private activeColor: number;
  private cfg: LadderLayoutCfg;
  private wipeFlash: ReturnType<typeof setInterval> | null = null;

  // Pre-computed geometry
  private readonly titleAreaH: number;
  private readonly stepsAreaH: number;
  private readonly totalH: number;
  private readonly stepX: number;

  constructor(title: string, activeColor: number, cfg: LadderLayoutCfg) {
    this.activeColor = activeColor;
    this.cfg = cfg;
    this.container = new PIXI.Container();

    const { stepW, stepH, stepGap, panelW, titleFontSize, levelFontSize } = cfg;
    this.titleAreaH = TITLE_PAD_TOP + titleFontSize + TITLE_GAP;
    this.stepsAreaH = MAX_LEVEL * stepH + (MAX_LEVEL - 1) * stepGap;
    this.totalH     = this.titleAreaH + this.stepsAreaH + LEVEL_PAD + levelFontSize + 8;
    this.stepX      = (panelW - stepW) / 2;

    // Card background
    this.cardBg = new PIXI.Graphics();
    this.cardBg
      .roundRect(0, 0, panelW, this.totalH, 10)
      .fill({ color: 0x11112a })
      .stroke({ width: 1, color: 0x2a2a44 });
    this.container.addChild(this.cardBg);

    // Title
    this.titleText = new PIXI.Text({
      text: title,
      style: {
        fontSize: titleFontSize,
        fill: 0x9999bb,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        align: 'center',
      },
    });
    this.titleText.anchor.set(0.5, 0);
    this.titleText.position.set(panelW / 2, TITLE_PAD_TOP);
    this.container.addChild(this.titleText);

    // Steps (index 0 = level 1 at bottom, index MAX_LEVEL-1 = top)
    const labelFontSize = Math.max(9, Math.min(stepH - 4, 11));
    for (let i = 0; i < MAX_LEVEL; i++) {
      const step = new PIXI.Graphics();
      this.drawStep(step, 0x1e1e38, i);
      this.steps.push(step);
      this.container.addChild(step);

      // Level number inside each step
      const lbl = new PIXI.Text({
        text: String(i + 1),
        style: {
          fontSize: labelFontSize,
          fill: 0x44445a,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          align: 'center',
        },
      });
      lbl.anchor.set(0.5);
      lbl.position.set(
        this.stepX + stepW / 2,
        this.stepY(i) + stepH / 2,
      );
      this.stepLabels.push(lbl);
      this.container.addChild(lbl);
    }

    // Level counter below steps
    this.levelText = new PIXI.Text({
      text: '0 / 5',
      style: {
        fontSize: levelFontSize,
        fill: 0x666688,
        fontFamily: 'Arial',
        align: 'center',
      },
    });
    this.levelText.anchor.set(0.5, 0);
    this.levelText.position.set(
      panelW / 2,
      this.titleAreaH + this.stepsAreaH + LEVEL_PAD,
    );
    this.container.addChild(this.levelText);
  }

  get width(): number  { return this.cfg.panelW; }
  get height(): number { return this.totalH; }

  /** y-position of step i (0=level1/bottom, 4=level5/top) within the container. */
  private stepY(i: number): number {
    const { stepH, stepGap } = this.cfg;
    return this.titleAreaH + (MAX_LEVEL - 1 - i) * (stepH + stepGap);
  }

  private drawStep(g: PIXI.Graphics, color: number, i: number): void {
    const { stepW, stepH } = this.cfg;
    g.clear();
    g.roundRect(this.stepX, this.stepY(i), stepW, stepH, 4).fill({ color });
  }

  setLevel(level: number, animate = false): void {
    this.levelText.text = `${level} / ${MAX_LEVEL}`;
    this.levelText.style.fill = level > 0 ? 0xaaaacc : 0x666688;

    for (let i = 0; i < MAX_LEVEL; i++) {
      const filled = i < level;
      this.drawStep(this.steps[i], filled ? this.activeColor : 0x1e1e38, i);
      this.stepLabels[i].style.fill = filled ? 0xffffff : 0x44445a;
    }

    if (animate && level > 0) {
      // Flash the newly filled step white then back to active colour
      const idx = level - 1;
      this.drawStep(this.steps[idx], 0xffffff, idx);
      this.stepLabels[idx].style.fill = 0x222233;
      setTimeout(() => {
        this.drawStep(this.steps[idx], this.activeColor, idx);
        this.stepLabels[idx].style.fill = 0xffffff;
      }, 180);
    }
  }

  /** Flash all steps red → reset to zero (signals Tumbleweed wipe). */
  flashWipe(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wipeFlash !== null) clearInterval(this.wipeFlash);
      let toggle = false;
      let count = 0;
      this.wipeFlash = setInterval(() => {
        const color = toggle ? 0xe74c3c : 0x1e1e38;
        for (let i = 0; i < MAX_LEVEL; i++) {
          this.drawStep(this.steps[i], color, i);
          this.stepLabels[i].style.fill = toggle ? 0xffffff : 0x44445a;
        }
        toggle = !toggle;
        if (++count >= 6) {
          clearInterval(this.wipeFlash!);
          this.wipeFlash = null;
          this.setLevel(0);
          resolve();
        }
      }, 80);
    });
  }

  /** Flash all steps gold for Flower Bonus celebration. */
  flashFlowerBonus(): void {
    let toggle = false;
    let count = 0;
    const id = setInterval(() => {
      const color = toggle ? 0xf1c40f : this.activeColor;
      for (let i = 0; i < MAX_LEVEL; i++) {
        this.drawStep(this.steps[i], color, i);
        this.stepLabels[i].style.fill = 0xffffff;
      }
      toggle = !toggle;
      if (++count >= 8) clearInterval(id);
    }, 100);
  }

  /** Instant reset, no animation. Clears all temp visuals. */
  reset(): void {
    if (this.wipeFlash !== null) {
      clearInterval(this.wipeFlash);
      this.wipeFlash = null;
    }
    this.setLevel(0);
  }
}
