/**
 * FlowerBonusView — gold-accented panel showing the shared FLOWER BONUS target.
 *
 * Sits centred above the three ladders. When all three ladders reach level 5,
 * call setActive(true) to highlight the panel.
 * Game.ts calls reset() on collect, which calls setActive(false).
 */
import * as PIXI from 'pixi.js';
import { FLOWER_BONUS } from '../math/paytable';
import { type BonusCfg } from './LayoutManager';

const COL_FILL_IDLE    = 0x0e0b00;
const COL_FILL_ACTIVE  = 0x1e1600;
const COL_STROKE_IDLE  = 0x5a4a10;
const COL_STROKE_ACT   = 0xf1c40f;
const COL_LABEL_IDLE   = 0xb89030;
const COL_LABEL_ACT    = 0xffd84d;
const COL_VALUE_IDLE   = 0xeeddaa;
const COL_VALUE_ACT    = 0xffffff;

export class FlowerBonusView {
  readonly container: PIXI.Container;
  private panel: PIXI.Graphics;
  private labelText: PIXI.Text;
  private valueText: PIXI.Text;
  private cfg: BonusCfg;
  private _active = false;

  constructor(cfg: BonusCfg) {
    this.cfg = cfg;
    this.container = new PIXI.Container();

    const { panelW, panelH, fontSize } = cfg;

    // Background panel
    this.panel = new PIXI.Graphics();
    this.container.addChild(this.panel);

    // "🌸 FLOWER BONUS" label — upper half of panel
    this.labelText = new PIXI.Text({
      text: '🌸  FLOWER BONUS',
      style: {
        fontSize: Math.round(fontSize * 0.88),
        fill: COL_LABEL_IDLE,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        align: 'center',
        letterSpacing: 1,
      },
    });
    this.labelText.anchor.set(0.5, 0.5);
    this.labelText.position.set(panelW / 2, panelH * 0.33);
    this.container.addChild(this.labelText);

    // "+500 FUN" value — lower half of panel
    this.valueText = new PIXI.Text({
      text: `+${FLOWER_BONUS} FUN`,
      style: {
        fontSize: Math.round(fontSize * 1.18),
        fill: COL_VALUE_IDLE,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        align: 'center',
        letterSpacing: 2,
      },
    });
    this.valueText.anchor.set(0.5, 0.5);
    this.valueText.position.set(panelW / 2, panelH * 0.72);
    this.container.addChild(this.valueText);

    this.drawPanel(false);
  }

  private drawPanel(active: boolean): void {
    const { panelW, panelH } = this.cfg;
    this.panel.clear();
    this.panel
      .roundRect(0, 0, panelW, panelH, 10)
      .fill({ color: active ? COL_FILL_ACTIVE : COL_FILL_IDLE })
      .stroke({ width: active ? 2 : 1, color: active ? COL_STROKE_ACT : COL_STROKE_IDLE });
  }

  setActive(active: boolean): void {
    if (this._active === active) return;
    this._active = active;
    this.drawPanel(active);
    this.labelText.style.fill = active ? COL_LABEL_ACT  : COL_LABEL_IDLE;
    this.valueText.style.fill = active ? COL_VALUE_ACT  : COL_VALUE_IDLE;
  }

  /** Hard reset — called when the player collects or a new round starts. */
  reset(): void {
    this.setActive(false);
  }
}
