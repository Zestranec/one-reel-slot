/**
 * LayoutManager — single source of truth for all stage coordinates and sizes.
 *
 * Two discrete modes: 'desktop' (≥ 520px viewport) and 'mobile' (< 520px).
 * All UI views are parameterized by Layout; Game repositions containers using it.
 * Spacing system: multiples of 8 (8 / 16 / 24 / 32).
 */

export type LayoutMode = 'desktop' | 'mobile';

export interface LadderLayoutCfg {
  stepW: number;
  stepH: number;
  stepGap: number;
  panelW: number;
  titleFontSize: number;
  levelFontSize: number;
  gap: number;       // horizontal gap between adjacent ladder cards
  sectionY: number;  // y of the ladder section in stage space
}

export interface FooterCfg {
  y: number;
  h: number;
  pad: number;          // horizontal edge padding inside footer
  statLabelSize: number;
  statValueSize: number;
  btnW: number;
  btnH: number;
  btnFontSize: number;
  btnGap: number;       // gap between the two buttons
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
  ladder: LadderLayoutCfg;
  footer: FooterCfg;
}

export const MOBILE_BREAKPOINT = 520;

export function buildLayout(viewportW: number): Layout {
  return viewportW >= MOBILE_BREAKPOINT ? desktopLayout() : mobileLayout();
}

/**
 * Desktop: 780 × 590 logical canvas.
 *
 * Zones (y ranges):
 *   Title:   0   – 50
 *   Reel:    50  – 270  (220 × 220)
 *   Ladders: 286 – 456
 *   Footer:  458 – 590
 */
function desktopLayout(): Layout {
  const W = 780, H = 590;
  const reelSize = 220;
  const footerH = 132;
  const footerY = H - footerH;         // 458
  const reelY   = 50;
  const ladderY = reelY + reelSize + 16; // 286

  return {
    mode: 'desktop',
    stageW: W,
    stageH: H,
    titleY: 14,
    titleFontSize: 22,
    reelX: (W - reelSize) / 2,          // 280
    reelY,
    reelSize,
    ladder: {
      stepW: 44,
      stepH: 18,
      stepGap: 4,
      panelW: 92,
      titleFontSize: 13,
      levelFontSize: 11,
      gap: 32,
      sectionY: ladderY,                // 286
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
 * Mobile: 390 × 660 logical canvas.
 *
 * Zones (y ranges):
 *   Title:   0   – 40
 *   Reel:    40  – 200  (160 × 160)
 *   Ladders: 216 – 488
 *   Footer:  492 – 660
 */
function mobileLayout(): Layout {
  const W = 390, H = 660;
  const reelSize = 160;
  const footerH = 168;
  const footerY = H - footerH;          // 492
  const reelY   = 40;
  const ladderY = reelY + reelSize + 16; // 216

  return {
    mode: 'mobile',
    stageW: W,
    stageH: H,
    titleY: 10,
    titleFontSize: 15,
    reelX: (W - reelSize) / 2,           // 115
    reelY,
    reelSize,
    ladder: {
      stepW: 36,
      stepH: 22,
      stepGap: 5,
      panelW: 76,
      titleFontSize: 11,
      levelFontSize: 11,
      gap: 18,
      sectionY: ladderY,                 // 216
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
