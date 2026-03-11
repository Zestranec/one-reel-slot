import * as PIXI from 'pixi.js';
import { Game } from './game/Game';
import { buildLayout } from './game/ui/LayoutManager';
import './style.css';

async function main() {
  const layout = buildLayout(window.innerWidth);

  const app = new PIXI.Application();
  await app.init({
    width: layout.stageW,
    height: layout.stageH,
    backgroundColor: 0x0a0a1e,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio ?? 1, 2),
    autoDensity: true,
  });

  // CSS: width:100% + height:auto scales canvas on small screens;
  // max-width caps it at the logical canvas width so it never stretches.
  const canvas = app.canvas as HTMLCanvasElement;
  canvas.style.maxWidth = `${layout.stageW}px`;

  document.getElementById('app')!.appendChild(canvas);

  const game = new Game(app, layout);

  // ── Responsive resize ──────────────────────────────────────────────────────
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const newLayout = buildLayout(window.innerWidth);
      canvas.style.maxWidth = `${newLayout.stageW}px`;
      game.onResize(window.innerWidth);
    }, 150);
  });

  // ── DEV: press S to run quick RTP simulation in console ───────────────────
  if (import.meta.env.DEV) {
    window.addEventListener('keydown', async (e) => {
      if (e.key === 's' || e.key === 'S') {
        console.log('[DEV] Running 100,000 round simulation...');
        const { simulate, printSimResult } = await import('./game/math/simulate');
        printSimResult(simulate(100_000));
      }
    });
    console.log('[DEV] Press S to run RTP simulation in console');
  }
}

main();
