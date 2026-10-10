// Dev-only preview of the board outcome effects (fx-preview.html; vite builds only index.html).
// Query: ?level=<1-based campaign number>. Exposes `window.fxPreview` for headless checks.

import { Application } from 'pixi.js';
import { getRenderResolution, initAssets, loadGameAssets, resolveAssetUrl } from './game/assets';
import { initialState } from './game/engine';
import { CAMPAIGN, getCampaignLevel } from './game/levels';
import { StageController, type StageCallbacks } from './game/renderer/stageController';

const host = document.getElementById('stage') as HTMLDivElement;
const status = document.getElementById('status') as HTMLSpanElement;
const requested = Number(new URLSearchParams(window.location.search).get('level') ?? '1');
let index = Math.min(CAMPAIGN.length - 1, Math.max(0, (Number.isFinite(requested) ? requested : 1) - 1));
let note = '';

await initAssets();
document.body.style.backgroundImage = `url("${resolveAssetUrl('background')}")`;
await loadGameAssets();

const app = new Application();
await app.init({
  antialias: true,
  backgroundAlpha: 0,
  width: Math.max(1, host.clientWidth),
  height: Math.max(1, host.clientHeight),
  resolution: getRenderResolution(),
  autoDensity: true,
  // On-demand rendering, as in PixiStage: the ticker runs only while something animates.
  autoStart: false,
});
host.appendChild(app.canvas);

const callbacks: StageCallbacks = {
  onBusyChange: () => undefined,
  onIntroStart: () => undefined,
  onEventStart: () => undefined,
  onTimelineEnd: () => undefined,
  onMoveRequest: () => undefined,
};
const controller = new StageController(app, host, () => callbacks, getRenderResolution);

/** Larry stands on the finish with the level won (no move highlights), as after a winning move. */
function loadLevel() {
  const { compiled } = getCampaignLevel(index);
  const start = initialState(compiled);
  const pos = compiled.finishIndex >= 0 ? compiled.finishIndex : start.pos;
  controller.load(compiled, { ...start, pos, status: 'won', lossReason: undefined });
  note = '';
}

function timedCelebrate(final: boolean) {
  const started = performance.now();
  note = '';
  void controller.celebrate(final).then(() => {
    note = `beat ${Math.round(performance.now() - started)} ms`;
  });
}

const actions: Record<string, () => void> = {
  prev: () => {
    index = (index + CAMPAIGN.length - 1) % CAMPAIGN.length;
    loadLevel();
  },
  next: () => {
    index = (index + 1) % CAMPAIGN.length;
    loadLevel();
  },
  celebrate: () => timedCelebrate(false),
  'celebrate-final': () => timedCelebrate(true),
  stuck: () => controller.showLoss('stuck'),
  'out-of-steps': () => controller.showLoss('out-of-steps'),
  clear: () => controller.clearOutcome(),
};

document.getElementById('controls')?.addEventListener('click', (event) => {
  const action = (event.target as HTMLElement).closest('button')?.dataset.fx;
  if (action !== undefined) actions[action]?.();
});
window.addEventListener('resize', () => controller.syncSize());
window.setInterval(() => {
  const stats = controller.stats;
  const level = getCampaignLevel(index);
  status.textContent = `${level.label} (${level.compiled.cellCount} cells) | ticker ${stats.tickerStarted ? 'on' : 'off'} | outcome ${stats.outcome ?? '-'} ${note}`;
}, 100);

loadLevel();
(window as unknown as { fxPreview: unknown }).fxPreview = {
  controller,
  actions,
  setLevel: (campaignIndex: number) => {
    index = campaignIndex;
    loadLevel();
  },
};
