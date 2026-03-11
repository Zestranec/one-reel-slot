/**
 * Game — top-level orchestrator.
 *
 * State machine: idle → running → resolve → win/lose → idle
 *
 * CRITICAL: Outcome is resolved BEFORE animation starts.
 * Animation only presents the pre-decided symbol.
 *
 * On viewport resize, if the layout mode changes (desktop ↔ mobile) the stage
 * is fully rebuilt while all game state (balance, round progress) is preserved.
 */
import * as PIXI from 'pixi.js';
import { GameState } from './state/GameState';
import { OutcomeController } from './controllers/OutcomeController';
import { ReelView } from './ui/ReelView';
import { LadderView } from './ui/LadderView';
import { HudView } from './ui/HudView';
import { FlowerBonusView } from './ui/FlowerBonusView';
import { BonusArrowsView, type BonusArrowEndpoints } from './ui/BonusArrowsView';
import { buildLayout, MOBILE_BREAKPOINT, type Layout } from './ui/LayoutManager';
import {
  CLOVER_PAY,
  FORGET_ME_NOT_PAY,
  ROSE_PAY,
} from './math/paytable';

const INITIAL_BALANCE = 100;
const INITIAL_BET     = 1;

export class Game {
  private app: PIXI.Application;
  private fsm     = new GameState();
  private outcome = new OutcomeController(INITIAL_BET);
  private balance = INITIAL_BALANCE;

  private layout: Layout;

  // View refs — rebuilt on layout-mode change
  private reel!: ReelView;
  private cloverLadder!: LadderView;
  private forgetLadder!: LadderView;
  private roseLadder!: LadderView;
  private hud!: HudView;
  private flowerBonusView!: FlowerBonusView;
  private bonusArrowsView!: BonusArrowsView;

  constructor(app: PIXI.Application, layout: Layout) {
    this.app    = app;
    this.layout = layout;
    this.buildUI(layout);
    this.refreshUI();
    this.fsm.transition('idle');
  }

  // ── UI construction ─────────────────────────────────────────────────────────

  private buildUI(L: Layout): void {
    // Destroy previous reel to remove its shared-ticker handler before rebuild.
    (this.reel as ReelView | undefined)?.destroy();

    const stage = this.app.stage;
    stage.removeChildren();

    // Stage background
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, L.stageW, L.stageH).fill({ color: 0x0a0a1e });
    stage.addChild(bg);

    // Title
    const title = new PIXI.Text({
      text: '✿  Flower Ladder  ✿',
      style: {
        fontSize: L.titleFontSize,
        fill: 0xf1c40f,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        align: 'center',
        letterSpacing: 2,
      },
    });
    title.anchor.set(0.5, 0);
    title.position.set(L.stageW / 2, L.titleY);
    stage.addChild(title);

    // Reel card
    this.reel = new ReelView(L.reelSize);
    this.reel.container.position.set(L.reelX, L.reelY);
    stage.addChild(this.reel.container);

    // ── Flower Bonus panel ──────────────────────────────────────────────────
    this.flowerBonusView = new FlowerBonusView(L.bonus);
    this.flowerBonusView.container.position.set(
      (L.stageW - L.bonus.panelW) / 2,
      L.bonus.panelY,
    );
    stage.addChild(this.flowerBonusView.container);

    // ── Ladder section ──────────────────────────────────────────────────────
    const lad          = L.ladder;
    const ladderTotalW = lad.panelW * 3 + lad.gap * 2;
    const ladderStartX = (L.stageW - ladderTotalW) / 2;

    // Subtle section background spanning all 3 cards
    const sectionBg = new PIXI.Graphics();
    sectionBg
      .roundRect(
        ladderStartX - 12,
        lad.sectionY - 12,
        ladderTotalW + 24,
        L.footer.y - lad.sectionY + 8,
        12,
      )
      .fill({ color: 0x0e0e22 })
      .stroke({ width: 1, color: 0x1e1e3a });
    stage.addChild(sectionBg);

    // Pass paytable arrays so each ladder can show per-step payout values.
    // To scale with bet: replace e.g. CLOVER_PAY with CLOVER_PAY.map(p => p * currentBet).
    this.cloverLadder = new LadderView('Clover',        0x2ecc71, lad, CLOVER_PAY);
    this.forgetLadder = new LadderView('Forget-me-not', 0x3498db, lad, FORGET_ME_NOT_PAY);
    this.roseLadder   = new LadderView('Rose',          0xe74c3c, lad, ROSE_PAY);

    const lx0 = ladderStartX;
    const lx1 = ladderStartX + lad.panelW + lad.gap;
    const lx2 = ladderStartX + (lad.panelW + lad.gap) * 2;

    this.cloverLadder.container.position.set(lx0, lad.sectionY);
    this.forgetLadder.container.position.set(lx1, lad.sectionY);
    this.roseLadder.container.position.set(  lx2, lad.sectionY);

    stage.addChild(this.cloverLadder.container);
    stage.addChild(this.forgetLadder.container);
    stage.addChild(this.roseLadder.container);

    // ── Bonus arrows ────────────────────────────────────────────────────────
    // Each arrow tail starts at the top-centre of its ladder card (stage space).
    // Each arrow head converges at the bottom-centre of the bonus panel.
    const arrowTailY = lad.sectionY;  // top edge of each ladder card
    const bonusBottom: [number, number] = [
      L.stageW / 2,
      L.bonus.panelY + L.bonus.panelH,
    ];
    const endpoints: BonusArrowEndpoints = {
      ladderTops: [
        [lx0 + lad.panelW / 2, arrowTailY],
        [lx1 + lad.panelW / 2, arrowTailY],
        [lx2 + lad.panelW / 2, arrowTailY],
      ],
      bonusBottom,
    };

    this.bonusArrowsView = new BonusArrowsView(endpoints);
    // Container at (0,0) — draws in absolute stage coordinates
    this.bonusArrowsView.container.position.set(0, 0);
    stage.addChild(this.bonusArrowsView.container);

    // ── Footer HUD ──────────────────────────────────────────────────────────
    this.hud = new HudView(L.stageW, L.footer, {
      onSpin:    () => this.onSpin(),
      onCollect: () => this.onCollect(),
    });
    this.hud.container.position.set(0, L.footer.y);
    stage.addChild(this.hud.container);
  }

  private refreshUI(): void {
    const s = this.outcome.getState();
    this.hud.setBalance(this.balance);
    this.hud.setBet(s.currentBet);
    this.hud.setCollectValue(s.currentCollectValue, s.collectEnabled);
    this.cloverLadder.setLevel(s.cloverLevel);
    this.forgetLadder.setLevel(s.forgetLevel);
    this.roseLadder.setLevel(s.roseLevel);
    const bonusActive = s.flowerBonusActive;
    this.hud.setFlowerBonus(bonusActive);
    this.flowerBonusView.setActive(bonusActive);
    this.bonusArrowsView.setActive(bonusActive);
  }

  // ── Resize support ──────────────────────────────────────────────────────────

  onResize(viewportW: number): void {
    const wasMobile = this.layout.mode === 'mobile';
    const isMobile  = viewportW < MOBILE_BREAKPOINT;
    if (wasMobile === isMobile) return;

    this.layout = buildLayout(viewportW);
    this.app.renderer.resize(this.layout.stageW, this.layout.stageH);
    this.buildUI(this.layout);
    this.refreshUI();
    this.fsm.transition('idle');
    this.hud.setSpinEnabled(true);
    this.hud.releaseGesture();
  }

  // ── Game actions ────────────────────────────────────────────────────────────

  private async onSpin(): Promise<void> {
    if (this.fsm.isLocked) return;
    if (this.balance < this.outcome.getState().currentBet) {
      this.hud.setStatus('Insufficient balance!', 0xe74c3c);
      this.hud.releaseGesture();
      return;
    }

    this.fsm.transition('running');
    this.hud.setSpinEnabled(false);

    this.balance -= this.outcome.getState().currentBet;
    this.hud.setBalance(this.balance);

    // *** OUTCOME DECIDED HERE — before animation ***
    const symbol = this.outcome.resolveNextSpin();
    this.outcome.applySymbol(symbol);
    const state = this.outcome.getState();

    this.fsm.transition('resolve');

    await this.reel.spinTo(symbol);

    if (symbol === 'Tumbleweed') {
      this.hud.setStatus('Tumbleweed! All progress wiped.', 0xe74c3c);
      await Promise.all([
        this.cloverLadder.flashWipe(),
        this.forgetLadder.flashWipe(),
        this.roseLadder.flashWipe(),
      ]);
      this.reel.pulse(0xe74c3c);
    } else if (symbol === 'GoldenSeed') {
      this.hud.setStatus('Golden Seed! All ladders +1!', 0xf1c40f);
      this.reel.pulse(0xf1c40f);
      this.cloverLadder.setLevel(state.cloverLevel, true);
      this.forgetLadder.setLevel(state.forgetLevel, true);
      this.roseLadder.setLevel(state.roseLevel, true);
    } else {
      this.hud.setStatus('');
      if (symbol === 'Clover')      this.cloverLadder.setLevel(state.cloverLevel, true);
      if (symbol === 'ForgetMeNot') this.forgetLadder.setLevel(state.forgetLevel, true);
      if (symbol === 'Rose')        this.roseLadder.setLevel(state.roseLevel, true);
    }

    if (state.flowerBonusActive) {
      this.hud.setFlowerBonus(true);
      this.flowerBonusView.setActive(true);
      this.bonusArrowsView.setActive(true);
      this.cloverLadder.flashFlowerBonus();
      this.forgetLadder.flashFlowerBonus();
      this.roseLadder.flashFlowerBonus();
    }

    this.hud.setCollectValue(state.currentCollectValue, state.collectEnabled);
    this.fsm.transition('idle');
    this.hud.setSpinEnabled(true);
    this.hud.releaseGesture();
  }

  private onCollect(): void {
    if (this.fsm.isLocked) return;
    if (!this.outcome.getState().collectEnabled) return;

    this.fsm.transition('win');

    const payout = this.outcome.collect();
    this.balance += payout;

    this.cloverLadder.reset();
    this.forgetLadder.reset();
    this.roseLadder.reset();
    this.reel.reset();
    this.flowerBonusView.reset();
    this.bonusArrowsView.reset();
    this.hud.reset();

    this.hud.setBalance(this.balance);
    this.hud.setStatus(`Collected ${payout.toFixed(1)} FUN — round cleared`, 0x2ecc71);

    this.fsm.transition('idle');
    this.hud.setSpinEnabled(true);
    this.hud.releaseGesture();
  }
}
