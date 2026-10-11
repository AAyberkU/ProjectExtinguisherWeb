// Builds runtime assets from the original art in /art-source.
//
// 1. Prepare: every original image is cropped to its visible pixels (where its group asks for it),
//    resized, and staged with AssetPack folder tags. Originals stay untouched, so the artist can
//    deliver whole pages at any size without cropping. Board art (tiles and objects) keeps the
//    drawings' relative scale; see BOARD_ART.
// 2. Pack: AssetPack builds the gameplay atlas (@2x and @1x), WebP/PNG images, MP3 audio, and a
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
const GAME_ATLAS = 'game{m}/atlas{tps}';

// Target sizes are the @2x texture sizes; AssetPack derives the @1x copies. `trim` crops each
// image to its visible pixels first (stand-alone images only). `board` groups are cropped and
// sized by BOARD_ART instead.
const IMAGE_GROUPS = [
  { source: 'images/tiles', staging: GAME_ATLAS, board: true },
  { source: 'images/objects', staging: GAME_ATLAS, board: true },
  { source: 'images/characters', staging: GAME_ATLAS, resize: { height: 384 }, trim: true },
  { source: 'images/backgrounds', staging: 'ui{m}/backgrounds{nomip}', resize: { width: 1920 } },
];
const AUDIO_GROUP = { source: 'audio', staging: 'audio{m}' };

// Board art is drawn on whole pages at one shared drawing scale. Every image is cropped to its
// visible pixels and scaled by one factor taken from the floor tile, so the drawings keep their
// authored sizes relative to the tile and the renderer places them by texture size.
const BOARD_ART = {
  // The floor's hex width becomes this @2x width; the same factor applies to all board art.
  reference: 'tile_floor',
  referenceWidth: 512,
  // Full hex tiles that replace the floor are fitted to exactly the floor's size (as drawn they
  // differ from it by 1-2 %).
  fullTiles: new Set(['tile_start', 'tile_finish']),
  // The floor and full tiles are cropped to their hex body (pixels above this alpha), which drops
  // the faint brush haze and stray strokes around the hex so the hexes tile exactly.
  hexBodyAlpha: 40,
  // Aligned sets: images that replace or stack on each other (door states, switch colours). All
  // files whose names match one pattern are cropped to the union of their visible boxes, so the
  // set stays aligned after cropping.
  alignedSets: [/^obj_door_/, /^obj_switch_/],
  // Delivered on a different canvas, so the shared scale does not apply: @2x size chosen by eye.
  ownSize: { obj_plus1: { width: 300 } },
};

async function listFiles(directory, extensions) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);

  return entries
    .filter((entry) => entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort();
}

/** Bounding box of the pixels with alpha above `minAlpha`, or null when there are none. */
async function visibleBox(file, minAlpha = 0) {
  const { data, info } = await sharp(file).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let left = width;
  let right = -1;
  let top = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let first = -1;
    let last = -1;

    for (let x = 0; x < width; x += 1) {
      if (data[row + x] > minAlpha) {
        if (first < 0) first = x;
        last = x;
      }
    }

    if (first >= 0) {
      left = Math.min(left, first);
      right = Math.max(right, last);
      if (top < 0) top = y;
      bottom = y;
    }
  }

  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function unionBox(a, b) {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  const right = Math.max(a.left + a.width, b.left + b.width);
  const bottom = Math.max(a.top + a.height, b.top + b.height);

  return { left, top, width: right - left, height: bottom - top };
}

async function writeImage(file, box, resize, output) {
  const image = box === null ? sharp(file) : sharp(file).extract(box);

  await image.resize(resize).png().toFile(output);
}

async function prepareBoardArt(groups) {
  const items = [];

  for (const group of groups) {
    const sourceDir = path.join(sourceRoot, group.source);
    const stagingDir = path.join(stagingRoot, group.staging);

    await fs.mkdir(stagingDir, { recursive: true });

    for (const name of await listFiles(sourceDir, IMAGE_EXTENSIONS)) {
      const file = path.join(sourceDir, name);
      const alias = path.parse(name).name;
      const hexTile = alias === BOARD_ART.reference || BOARD_ART.fullTiles.has(alias);
      const box = await visibleBox(file, hexTile ? BOARD_ART.hexBodyAlpha : 0);

      items.push({ alias, file, hexTile, box, output: path.join(stagingDir, `${alias}.png`) });
    }
  }

  for (const pattern of BOARD_ART.alignedSets) {
    const members = items.filter((item) => pattern.test(item.alias) && item.box !== null);
    const shared = members.reduce((box, item) => (box === null ? item.box : unionBox(box, item.box)), null);

    for (const item of members) {
      item.box = shared;
    }
  }

  const reference = items.find((item) => item.alias === BOARD_ART.reference)?.box;

  if (!reference) {
    throw new Error(`[assets] board art needs a visible ${BOARD_ART.reference} to set the drawing scale`);
  }

  const scale = BOARD_ART.referenceWidth / reference.width;
  const floorSize = { width: BOARD_ART.referenceWidth, height: Math.round(reference.height * scale) };

  for (const { alias, file, hexTile, output, box } of items) {
    let resize;

    if (BOARD_ART.ownSize[alias]) {
      resize = { ...BOARD_ART.ownSize[alias], fit: 'inside' };
    } else if (hexTile) {
      resize = { ...floorSize, fit: 'fill' };
    } else {
      const size = box ?? (await sharp(file).metadata());
      resize = {
        width: Math.max(1, Math.round(size.width * scale)),
        height: Math.max(1, Math.round(size.height * scale)),
        fit: 'fill',
      };
    }

    await writeImage(file, box, resize, output);
  }

  return items.length;
}

async function prepareImages() {
  let count = await prepareBoardArt(IMAGE_GROUPS.filter((group) => group.board));

  for (const group of IMAGE_GROUPS.filter((entry) => !entry.board)) {
    const sourceDir = path.join(sourceRoot, group.source);
    const stagingDir = path.join(stagingRoot, group.staging);

    await fs.mkdir(stagingDir, { recursive: true });

    for (const name of await listFiles(sourceDir, IMAGE_EXTENSIONS)) {
      const file = path.join(sourceDir, name);
      // Trimming runs first so the resize target applies to the visible drawing.
      const box = group.trim ? await visibleBox(file) : null;

      await writeImage(
        file,
        box,
        { ...group.resize, fit: 'inside', withoutEnlargement: true },
        path.join(stagingDir, `${path.parse(name).name}.png`),
      );
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
