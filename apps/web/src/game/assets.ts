import { Assets } from 'pixi.js';

// Built by `npm run assets` from /art-source into public/game-assets. Assets are referenced by alias
// (file name without extension), never by file path.
const ASSET_BASE_PATH = 'game-assets/';
const ASSET_MANIFEST = 'manifest.json';
const GAME_BUNDLE = 'game';
const MIN_RENDER_RESOLUTION = 1;
const MAX_RENDER_RESOLUTION = 3;

type ProgressListener = (progress: number) => void;

let initPromise: Promise<void> | null = null;
let gameBundlePromise: Promise<void> | null = null;
let gameBundleProgress = 0;
const progressListeners = new Set<ProgressListener>();

/** The device pixel ratio clamped to 1-3: honest on 1x screens, bounded on very dense ones. */
export function getRenderResolution(): number {
  return Math.min(Math.max(window.devicePixelRatio || 1, MIN_RENDER_RESOLUTION), MAX_RENDER_RESOLUTION);
}

export function initAssets(): Promise<void> {
  if (initPromise === null) {
    initPromise = Assets.init({
      basePath: ASSET_BASE_PATH,
      manifest: ASSET_MANIFEST,
      texturePreference: { resolution: getRenderResolution(), format: ['webp', 'png'] },
    }).catch((error: unknown) => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

function setGameBundleProgress(progress: number) {
  gameBundleProgress = progress;

  for (const listener of progressListeners) {
    listener(progress);
  }
}

/** Loads the gameplay atlas (tiles and Larry). Safe to call repeatedly; retries after a failure. */
export function loadGameAssets(): Promise<void> {
  if (gameBundlePromise === null) {
    setGameBundleProgress(0);
    gameBundlePromise = initAssets()
      .then(() => Assets.loadBundle(GAME_BUNDLE, setGameBundleProgress))
      .then(() => setGameBundleProgress(1))
      .catch((error: unknown) => {
        gameBundlePromise = null;
        throw error;
      });
  }

  return gameBundlePromise;
}

export function subscribeGameAssetProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener);
  listener(gameBundleProgress);

  return () => progressListeners.delete(listener);
}

/**
 * Returns the absolute, preferred-format URL for a manifest alias. Call after `initAssets()`
 * resolves. Absolute URLs stay correct inside CSS, whose relative URLs resolve against the
 * stylesheet instead of the page.
 */
export function resolveAssetUrl(alias: string): string {
  const resolved = Assets.resolver.resolve(alias);

  if (resolved === undefined || typeof resolved.src !== 'string') {
    throw new Error(`Unknown asset alias '${alias}'. Run \`npm run assets\` after adding art.`);
  }

  return new URL(resolved.src, document.baseURI).href;
}
