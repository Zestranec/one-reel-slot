/**
 * ReelConfig — all spin animation tuning in one place.
 *
 * Adjust these values to change the feel of the spin without touching
 * animation logic anywhere else.
 */
export interface ReelConfig {
  /** Pre-spin: strip bounces backward (opposite to spin direction) before launch. */
  bounceUp: { amount: number; duration: number };
  /** Acceleration phase: ramp from 0 to full spin speed. */
  spinUp: { duration: number };
  /**
   * Continuous spin phase.
   * speed — pixels per second.
   * minScreens — minimum number of cell-heights to scroll before stopping.
   */
  spinning: { speed: number; minScreens: number };
  /** Post-arrival: reel overshoots target, then returns. */
  bounceDown: { amount: number; duration: number };
  /** Final tween from overshoot back to exact target position. */
  settling: { duration: number };
  /**
   * Alpha of the dark motion-blur overlay drawn over the strip while spinning.
   * 0 = none, 0.30 = noticeable. Pure cosmetic.
   */
  blurAlpha: number;
}

export const DEFAULT_REEL_CONFIG: ReelConfig = {
  bounceUp:   { amount: 18,   duration: 90  },
  spinUp:     { duration: 200              },
  spinning:   { speed: 1200, minScreens: 8 },
  bounceDown: { amount: 18,   duration: 130 },
  settling:   { duration: 100             },
  blurAlpha:  0.22,
};
