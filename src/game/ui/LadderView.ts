/**
 * LadderView — visual progress card for a single ladder (levels 0–5).
 *
 * Each step displays its payout value (from paytable, optionally scaled by bet)
 * so the player always sees what each level is worth.
 *
 * Constructor accepts `payouts: readonly number[]`
 *   index 0 = unused (level 0 has no payout)
 *   index 1 = L1 value, index 2 = L2, … index 5 = L5
 *
 * Pass `payouts.map(p => p * currentBet)` for bet-scaled display (future-proof).
 * All game methods (setLevel, flashWipe, flashFlowerBonus, reset) are preserved.
 */
import * as PIXI from 'pixi.js';
import { MAX_LEVEL } from '../math/paytable';
import { type LadderLayoutCfg } from './LayoutManager';

const TITLE_PAD_TOP = 10;
const TITLE_GAP     = 6;
const LEVEL_PAD     = 6;

const COL_STEP_EMPTY         = 0x1e1e38;
const COL_REWARD_INACTIVE    = 0x4a4a64;
const COL_REWARD_ACTIVE      = 0xffffff;
const COL_REWARD_FLASH_WHITE = 0x222233;

export class LadderView {
  readonly container: PIXI.Container;
  private steps: PIXI.Graphics[]    = [];
  private rewardLabels: PIXI.Text[] = [];  // one per step, shows payout value
  private titleText: PIXI.Text;
  private levelText: PIXI.Text;
  private cardBg: PIXI.Graphics;
  private activeColor: number;
  private cfg: LadderLayoutCfg;
  private wipeFlash: ReturnType<typeof setInterval> | null = null;

  private readonly titleAreaH: number;
  private readonly stepsAreaH: number;
  private readonly totalH: number;
  private readonly stepX: number;

  constructor(
    title: string,
    activeColor: number,
    cfg: LadderLayoutCfg,
    payouts: readonly number[],
  ) {
    this.activeColor = activeColor;
    this.cfg = cfg;
    this.container = new PIXI.Container();

    const { stepW, stepH, stepGap, panelW, titleFontSize, levelFontSize, rewardFontSize } = cfg;
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

    // Steps + payout labels (i=0 is level 1 / bottom, i=MAX_LEVEL-1 is level 5 / top)
    for (let i = 0; i < MAX_LEVEL; i++) {
      const step = new PIXI.Graphics();
      this.drawStep(step, COL_STEP_EMPTY, i);
      this.steps.push(step);
      this.container.addChild(step);

      const reward = payouts[i + 1] ?? 0;
      const lbl = new PIXI.Text({
        text: String(reward),
        style: {
          fontSize: rewardFontSize,
          fill: COL_REWARD_INACTIVE,
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
      this.rewardLabels.push(lbl);
      this.container.addChild(lbl);
    }

    // "X / 5" counter below the steps
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

  /** y-position of step i (0 = level-1 / bottom, MAX_LEVEL-1 = level-5 / top). */
  private stepY(i: number): number {
    const { stepH, stepGap } = this.cfg;
    return this.titleAreaH + (MAX_LEVEL - 1 - i) * (stepH + stepGap);
  }

  private drawStep(g: PIXI.Graphics, color: number, i: number): void {
    const { stepW, stepH } = this.cfg;
    g.clear();
    g.roundRect(this.stepX, this.stepY(i), stepW, stepH, 4).fill({ color });
  }

  // ── Public game API (all preserved) ────────────────────────────────────────

  setLevel(level: number, animate = false): void {
    this.levelText.text       = `${level} / ${MAX_LEVEL}`;
    this.levelText.style.fill = level > 0 ? 0xaaaacc : 0x666688;

    for (let i = 0; i < MAX_LEVEL; i++) {
      const filled = i < level;
      this.drawStep(this.steps[i], filled ? this.activeColor : COL_STEP_EMPTY, i);
      this.rewardLabels[i].style.fill = filled ? COL_REWARD_ACTIVE : COL_REWARD_INACTIVE;
    }

    if (animate && level > 0) {
      const idx = level - 1;
      this.drawStep(this.steps[idx], 0xffffff, idx);
      this.rewardLabels[idx].style.fill = COL_REWARD_FLASH_WHITE;
      setTimeout(() => {
        this.drawStep(this.steps[idx], this.activeColor, idx);
        this.rewardLabels[idx].style.fill = COL_REWARD_ACTIVE;
      }, 180);
    }
  }

  /** Flash red then wipe — Tumbleweed signal. */
  flashWipe(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wipeFlash !== null) clearInterval(this.wipeFlash);
      let toggle = false;
      let count  = 0;
      this.wipeFlash = setInterval(() => {
        const color = toggle ? 0xe74c3c : COL_STEP_EMPTY;
        for (let i = 0; i < MAX_LEVEL; i++) {
          this.drawStep(this.steps[i], color, i);
          this.rewardLabels[i].style.fill = toggle ? COL_REWARD_ACTIVE : COL_REWARD_INACTIVE;
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

  /** Flash gold — Flower Bonus celebration. */
  flashFlowerBonus(): void {
    let toggle = false;
    let count  = 0;
    const id = setInterval(() => {
      const color = toggle ? 0xf1c40f : this.activeColor;
      for (let i = 0; i < MAX_LEVEL; i++) {
        this.drawStep(this.steps[i], color, i);
        this.rewardLabels[i].style.fill = COL_REWARD_ACTIVE;
      }
      toggle = !toggle;
      if (++count >= 8) clearInterval(id);
    }, 100);
  }

  /** Instant reset — no animation, clears all temp visuals. */
  reset(): void {
    if (this.wipeFlash !== null) {
      clearInterval(this.wipeFlash);
      this.wipeFlash = null;
    }
    this.setLevel(0);
  }
}
