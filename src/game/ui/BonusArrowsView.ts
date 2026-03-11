/**
 * BonusArrowsView — three arrows converging from the top of each ladder card
 * upward to the bottom-centre of the FlowerBonusView panel.
 *
 * Coordinates are absolute stage-space values, computed by Game.ts from layout.
 * setActive(true) brightens all arrows to gold when the bonus condition is met.
 *
 * Container sits at (0, 0) in the stage — it draws in global stage coordinates.
 */
import * as PIXI from 'pixi.js';

/** One [x, y] endpoint for the tail (ladder top) of each arrow. */
export type ArrowPoint = [number, number];

export interface BonusArrowEndpoints {
  /** Top-centre of each of the 3 ladder cards, in stage space [x, y]. */
  ladderTops: [ArrowPoint, ArrowPoint, ArrowPoint];
  /** Bottom-centre of the FlowerBonus panel, in stage space [x, y]. */
  bonusBottom: ArrowPoint;
}

const COL_IDLE   = 0x7a6220;
const COL_ACTIVE = 0xf1c40f;
const ALPHA_IDLE   = 0.65;
const ALPHA_ACTIVE = 0.95;
const LINE_W_IDLE   = 1.5;
const LINE_W_ACTIVE = 2;
const TIP_LEN   = 7;    // arrowhead leg length
const TIP_SPREAD = 0.42; // half-angle of arrowhead in radians (~24°)

export class BonusArrowsView {
  readonly container: PIXI.Container;
  private g: PIXI.Graphics;
  private endpoints: BonusArrowEndpoints;
  private _active = false;

  constructor(endpoints: BonusArrowEndpoints) {
    this.endpoints = endpoints;
    this.container = new PIXI.Container();
    this.g = new PIXI.Graphics();
    this.container.addChild(this.g);
    this.redraw(false);
  }

  setActive(active: boolean): void {
    if (this._active === active) return;
    this._active = active;
    this.redraw(active);
  }

  /** Hard reset — called on collect or round start. */
  reset(): void {
    this.setActive(false);
  }

  private redraw(active: boolean): void {
    this.g.clear();
    const color   = active ? COL_ACTIVE   : COL_IDLE;
    const alpha   = active ? ALPHA_ACTIVE : ALPHA_IDLE;
    const lineW   = active ? LINE_W_ACTIVE : LINE_W_IDLE;
    const [bx, by] = this.endpoints.bonusBottom;

    for (const [tx, ty] of this.endpoints.ladderTops) {
      this.drawArrow(tx, ty, bx, by, color, alpha, lineW);
    }
  }

  /**
   * Draw a line from (x1,y1) to (x2,y2) with an arrowhead at (x2,y2).
   * In our layout y1 > y2, so the arrow always points upward on screen.
   */
  private drawArrow(
    x1: number, y1: number,
    x2: number, y2: number,
    color: number, alpha: number, lineW: number,
  ): void {
    // Shaft
    this.g
      .moveTo(x1, y1)
      .lineTo(x2, y2)
      .stroke({ width: lineW, color, alpha });

    // Arrowhead triangle at (x2, y2)
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const ax = x2 - TIP_LEN * Math.cos(angle - TIP_SPREAD);
    const ay = y2 - TIP_LEN * Math.sin(angle - TIP_SPREAD);
    const bx = x2 - TIP_LEN * Math.cos(angle + TIP_SPREAD);
    const by = y2 - TIP_LEN * Math.sin(angle + TIP_SPREAD);

    this.g
      .poly([x2, y2, ax, ay, bx, by])
      .fill({ color, alpha });
  }
}
