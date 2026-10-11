// Builds runtime assets from the original art in /art-source.
//
// 1. Prepare: every original image is (in trimmed groups) cropped to its visible pixels, resized to
//    its group's @2x target size, and staged with AssetPack folder tags. Originals stay untouched,
//    so the artist can deliver whole pages at any size without cropping.
// 2. Pack: AssetPack builds the tile atlas (@2x and @1x), WebP/PNG images, MP3 audio, and a
//    Pixi manifest into apps/web/public/game-assets. AssetPack's cache skips unchanged files.
//
// Usage: npm run assets (from apps/web or the repository root).
import { AssetPack } from '@assetpack/core';
import { pixiPipes } from '@assetpack/core/pixi';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '../..');
const sourceRoot = path.join(repoRoot, 'art-source');
const cacheRoot = path.join(appRoot, '.assets-cache');
const stagingRoot = path.join(cacheRoot, 'staging');
const outputRoot = path.join(appRoot, 'public', 'game-assets');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg']);

// Target sizes are the @2x texture sizes; AssetPack derives the @1x copies. `trim` crops each
// image to its visible pixels first: only for images that stand alone. Images that replace or
// stack on each other (door states, tile layers, poses) must keep a shared canvas instead.
const IMAGE_GROUPS = [
  { source: 'images/tiles', staging: 'game{m}/atlas{tps}', resize: { width: 512 } },
  { source: 'images/characters', staging: 'game{m}/atlas{tps}', resize: { height: 384 }, trim: true },
  { source: 'images/backgrounds', staging: 'ui{m}/backgrounds{nomip}', resize: { width: 1920 } },
];
const AUDIO_GROUP = { source: 'audio', staging: 'audio{m}' };

async function listFiles(directory, extensions) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);

  return entries
    .filter((entry) => entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort();
}

async function prepareImages() {
  let count = 0;

  for (const group of IMAGE_GROUPS) {
    const sourceDir = path.join(sourceRoot, group.source);
    const stagingDir = path.join(stagingRoot, group.staging);

    await fs.mkdir(stagingDir, { recursive: true });

    for (const name of await listFiles(sourceDir, IMAGE_EXTENSIONS)) {
      const outputName = `${path.parse(name).name}.png`;

      const original = path.join(sourceDir, name);
      // Trimming runs as its own pass so the resize target applies to the visible drawing.
      const input = group.trim ? await sharp(original).trim({ threshold: 0 }).png().toBuffer() : original;

      await sharp(input)
        .resize({ ...group.resize, fit: 'inside', withoutEnlargement: true })
        .png()
        .toFile(path.join(stagingDir, outputName));
      count += 1;
    }
  }

  return count;
}

async function prepareAudio() {
  const sourceDir = path.join(sourceRoot, AUDIO_GROUP.source);
  const stagingDir = path.join(stagingRoot, AUDIO_GROUP.staging);
  const names = await listFiles(sourceDir, AUDIO_EXTENSIONS);

  await fs.mkdir(stagingDir, { recursive: true });
  await Promise.all(names.map((name) => fs.copyFile(path.join(sourceDir, name), path.join(stagingDir, name))));

  return names.length;
}

const sfxOutput = {
  formats: ['.mp3'],
  recompress: false,
  options: { audioBitrate: 96, audioChannels: 1, audioFrequency: 44100 },
};
const musicOutput = {
  formats: ['.mp3'],
  recompress: false,
  options: { audioBitrate: 128, audioChannels: 2, audioFrequency: 44100 },
};

await fs.rm(stagingRoot, { recursive: true, force: true });
const imageCount = await prepareImages();
const audioCount = await prepareAudio();
console.log(`[assets] prepared ${imageCount} images and ${audioCount} audio files`);

await new AssetPack({
  entry: stagingRoot,
  output: outputRoot,
  cache: true,
  cacheLocation: path.join(cacheRoot, 'assetpack'),
  logLevel: 'info',
  pipes: [
    ...pixiPipes({
      cacheBust: true,
      resolutions: { high: 2, default: 1 },
      compression: { png: true, jpg: false, webp: { quality: 90, alphaQuality: 90 } },
      texturePacker: { texturePacker: { nameStyle: 'short', removeFileExtension: true } },
      audio: { outputs: [sfxOutput] },
      manifest: { createShortcuts: true, trimExtensions: true },
    }),
  ],
  assetSettings: [{ files: ['**/music.*'], settings: { audio: { outputs: [musicOutput] } } }],
}).run();

// AssetPack keeps files from earlier runs (for example an atlas built at an older size). Delete
// every output file the manifest no longer references, so stale files never reach the build.
async function pruneUnreferenced() {
  const manifest = JSON.parse(await fs.readFile(path.join(outputRoot, 'manifest.json'), 'utf8'));
  const keep = new Set(['manifest.json']);
  for (const bundle of manifest.bundles) {
    for (const asset of bundle.assets) {
      for (const src of asset.src) {
        keep.add(src);
        if (src.endsWith('.json')) {
          const sheet = JSON.parse(await fs.readFile(path.join(outputRoot, src), 'utf8'));
          if (sheet.meta?.image) keep.add(path.posix.join(path.posix.dirname(src), sheet.meta.image));
        }
      }
    }
  }
  let removed = 0;
  for (const entry of await fs.readdir(outputRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const full = path.join(entry.parentPath, entry.name);
    const rel = path.relative(outputRoot, full).split(path.sep).join('/');
    if (!keep.has(rel)) {
      await fs.rm(full);
      removed += 1;
    }
  }
  return removed;
}

const pruned = await pruneUnreferenced();
console.log(`[assets] wrote ${path.relative(repoRoot, outputRoot)}${pruned ? ` (removed ${pruned} stale files)` : ''}`);
