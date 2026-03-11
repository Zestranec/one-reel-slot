/**
 * LayoutManager — single source of truth for all stage coordinates and sizes.
 *
 * Two discrete modes: 'desktop' (≥ 520px viewport) and 'mobile' (< 520px).
 * Spacing system: multiples of 8 (8 / 16 / 24 / 32).
 *
 * Zone layout (top → bottom):
 *   Title | Reel | FlowerBonus panel | [arrow gap] | Ladders | Footer
 */

export type LayoutMode = 'desktop' | 'mobile';

export interface LadderLayoutCfg {
  stepW: number;
  stepH: number;
  stepGap: number;
  panelW: number;
  titleFontSize: number;
  levelFontSize: number;
  rewardFontSize: number;  // font size for the payout value rendered inside each step
  gap: number;             // horizontal gap between adjacent ladder cards
  sectionY: number;        // y of the ladder section in stage space
}

export interface BonusCfg {
  panelY: number;    // top of the bonus panel in stage space
  panelH: number;    // height of the bonus panel
  panelW: number;    // width (centered on stageW/2)
  fontSize: number;  // single-line text size inside the panel
}

export interface FooterCfg {
  y: number;
  h: number;
  pad: number;
  statLabelSize: number;
  statValueSize: number;
  btnW: number;
  btnH: number;
  btnFontSize: number;
  btnGap: number;
  statusFontSize: number;
}

export interface Layout {
  mode: LayoutMode;
  stageW: number;
  stageH: number;
  titleY: number;
  titleFontSize: number;
  reelX: number;
  reelY: number;
  reelSize: number;
  bonus: BonusCfg;
  ladder: LadderLayoutCfg;
  footer: FooterCfg;
}

export const MOBILE_BREAKPOINT = 520;

export function buildLayout(viewportW: number): Layout {
  return viewportW >= MOBILE_BREAKPOINT ? desktopLayout() : mobileLayout();
}

/**
 * Desktop: 780 × 680 logical canvas.
 *
 * Zones (y ranges):
 *   Title:         0  –  50
 *   Reel:         50  – 270  (220 × 220)
 *   Bonus panel: 282  – 326  (h=44, w=320, centred)
 *   Arrow gap:   326  – 364  (38px)
 *   Ladders:     364  – 548
 *   Footer:      548  – 680
 */
function desktopLayout(): Layout {
  const W = 780, H = 680;
  const reelSize = 220;
  const reelY    = 50;
  const bonusY   = reelY + reelSize + 12;  // 282
  const bonusH   = 44;
  const bonusW   = 320;
  const ladderY  = bonusY + bonusH + 38;   // 364
  const footerH  = 132;
  const footerY  = H - footerH;             // 548

  return {
    mode: 'desktop',
    stageW: W,
    stageH: H,
    titleY: 14,
    titleFontSize: 22,
    reelX: (W - reelSize) / 2,  // 280
    reelY,
    reelSize,
    bonus: { panelY: bonusY, panelH: bonusH, panelW: bonusW, fontSize: 13 },
    ladder: {
      stepW: 44,
      stepH: 18,
      stepGap: 4,
      panelW: 92,
      titleFontSize: 13,
      levelFontSize: 11,
      rewardFontSize: 12,
      gap: 32,
      sectionY: ladderY,  // 364
    },
    footer: {
      y: footerY,
      h: footerH,
      pad: 24,
      statLabelSize: 11,
      statValueSize: 17,
      btnW: 172,
      btnH: 52,
      btnFontSize: 18,
      btnGap: 24,
      statusFontSize: 13,
    },
  };
}

/**
 * Mobile: 390 × 760 logical canvas.
 *
 * Zones (y ranges):
 *   Title:         0  –  40
 *   Reel:         40  – 200  (160 × 160)
 *   Bonus panel: 212  – 248  (h=36, w=250, centred)
 *   Arrow gap:   248  – 280  (32px)
 *   Ladders:     280  – 592
 *   Footer:      592  – 760
 */
function mobileLayout(): Layout {
  const W = 390, H = 760;
  const reelSize = 160;
  const reelY    = 40;
  const bonusY   = reelY + reelSize + 12;  // 212
  const bonusH   = 36;
  const bonusW   = 250;
  const ladderY  = bonusY + bonusH + 32;   // 280
  const footerH  = 168;
  const footerY  = H - footerH;             // 592

  return {
    mode: 'mobile',
    stageW: W,
    stageH: H,
    titleY: 10,
    titleFontSize: 15,
    reelX: (W - reelSize) / 2,  // 115
    reelY,
    reelSize,
    bonus: { panelY: bonusY, panelH: bonusH, panelW: bonusW, fontSize: 11 },
    ladder: {
      stepW: 36,
      stepH: 22,
      stepGap: 5,
      panelW: 76,
      titleFontSize: 11,
      levelFontSize: 11,
      rewardFontSize: 14,
      gap: 18,
      sectionY: ladderY,  // 280
    },
    footer: {
      y: footerY,
      h: footerH,
      pad: 16,
      statLabelSize: 10,
      statValueSize: 15,
      btnW: 148,
      btnH: 52,
      btnFontSize: 17,
      btnGap: 10,
      statusFontSize: 11,
    },
  };
}
