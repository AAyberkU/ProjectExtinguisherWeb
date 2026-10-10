# Art, Audio, and Animation

## Team and decisions

- A dedicated artist draws all art. The artist works in layers.
- Art is **static**. All animation is done in code (Pixi transforms, tweens, effects). No Spine or
  frame-by-frame animation is planned; if frame animation is ever added, the atlas pipeline already
  supports it with a naming rule (`name_01..NN`) and a fixed canvas and pivot per frame.
- Tiles are **pointy-top** (corners up and down) to match the board.
- Delivery as separate layers (base hex, object, optional shadow) or as flattened tiles is decided
  when final art is near. Because the artist keeps layered sources, either choice stays cheap.
  Layers allow richer code animation (see below); if layers are delivered, each layer is exported on
  the full tile canvas, aligned, so layers stack without manual offsets.
- The artist sends files to Ayberk; the integrator names them and places them in `art-source/`.

## Asset pipeline

- Originals live in root `art-source/` and stay in Git as plain PNG, WAV, or MP3 (no Git LFS).
  Layered sources (PSD and similar) stay outside the repository.
- `npm run assets` (`apps/web/scripts/build-assets.mjs`) builds `apps/web/public/game-assets/`
  (generated, ignored by Git). `npm run dev` and `npm run build` run it first. AssetPack's cache in
  `apps/web/.assets-cache/` skips unchanged files.
- Step 1 resizes each original with sharp to its group's @2x target: `images/tiles` 256 px wide,
  `images/characters` 192 px tall, `images/backgrounds` 1920 px wide. Artists can always deliver
  large originals.
- Step 2 runs AssetPack 1.7 (`pixiPipes`): tiles and Larry go into one atlas at @2x and @1x, images
  become WebP (quality 90) with a PNG fallback, audio becomes MP3 (SFX 96 kbps mono, music 128 kbps
  stereo), file names get cache-busting hashes, and a Pixi manifest is written.
- Manifest bundles: `game` (atlas), `ui` (background), `audio`. `apps/web/src/game/assets.ts`
  initializes Pixi `Assets`, prefers WebP at the render resolution, reports `game` bundle progress
  to the loading screen, and resolves other aliases to absolute URLs.
- Code references art only by alias (file name without extension), never by path.
- Result on 2026-10-10: production build about 4.7 MB (was about 53 MB); a first gameplay load
  downloads about 2 MB plus the JS bundle.
- A Steam asset profile with larger targets can be added later from the same originals.

## Naming

Current aliases (jam placeholders):

| Alias | Use |
| --- | --- |
| `tile_path_01` .. `tile_path_10` | Floor variants |
| `tile_blocked_01` .. `tile_blocked_03` | Wall (blocker) variants |
| `tile_catapult_<dir>` | Launcher, one per direction |
| `tile_start`, `tile_goal`, `tile_health` | Start, finish, plus1 |
| `larry` | Player character |
| `background` | Full-screen background |
| `music`, `sfx_<name>` | Audio |

The catapult aliases still use the jam renderer's on-screen names (`right`, `up_right`, `up_left`,
`left`, `down_left`, `down_right`). When the hex-steps engine lands (roadmap step 1), tile aliases
move to the Puzzle Lab vocabulary, for example `tile_launcher_e`, `tile_mover_ne`, `tile_swamp`. New
names are fixed in this document at that time.

## Art still needed for the hex-steps mechanics

Tell the artist early. Mechanics and their visual needs:

- Floor (variants), wall/blocker (at least 3 variants; walls are now the most frequent tile and
  appear in large adjacent groups, so variants must sit well next to each other), start, finish.
- `plus1` (+1 step pickup).
- `launcher`: 6 directions.
- `swamp`.
- `mover`: 6 directions.
- `portal`: pairs must be distinguishable (the pool uses up to 3 pairs in one level).
- `switch` and `door`: 3 colours (A/B/C).
- `passage`: per-side bars (closed both ways) and one-way arrows.
- `refill`: shows a number (1-99), so the number is likely drawn in code over a plain base.
- `swap`: a marker showing the paired cells.
- Larry, background (must work in landscape and portrait), UI pieces.

Until art arrives, new tiles use code-drawn placeholder glyphs (see `docs/rules.md`, editor
presentation reference).

## Board presentation

- Every blocker is drawn, including the walls that pad large boards. Each wall picks one of the
  blocker variants with a seeded choice from the level id and cell coordinates, so a level always
  looks the same and walls never change between moves.
- Board size varies per level (19 to 91 cells); the board scales to fit. If 91-cell boards look too
  busy on phones, edge walls may be drawn quieter (gameplay is unaffected because walls and edges
  behave the same).
- Current placeholder art is the flat-top jam art rotated 30 degrees in `PixiStage.tsx`
  (`PLACEHOLDER_TILE_ROTATION`); set it to 0 when pointy-top art arrives.

## Code animation

Two layers of animation, both driven only by engine events (rules never wait on animation):

1. **Mechanic motion** (roadmap step 1, needed for readability): walk (editor reference 110 ms),
   launch (190 ms), slide (160 ms), teleport, swap exchange, level intro.
2. **Polish / juice** (roadmap step 4, grows with art): launcher object stretch on launch, `plus1`
   and refill pickups lifting off and fading with a number pop, walls dropping in during the intro,
   portal pull and glow, door opening on a switch press, swap exchange effect, Larry shadow and
   squash, idle breathing, win and fail effects, menu transitions.

Prerequisites (step 1): persistent tile objects instead of rebuilding the board on every move, and an
event-driven presentation layer. Richer per-object effects need layered art.

## Audio

- `apps/web/src/game/audio.ts` resolves the `audio` manifest aliases after asset initialization.
- Music: looping `HTMLAudioElement`, volume 0.4, starts on mount and retries on the first pointer or
  key input if autoplay is blocked.
- SFX: fetched and decoded into Web Audio buffers up front, with an HTMLAudio fallback; scheduled
  from ordered engine events.
- Current cues: `sfx_jump`, `sfx_catapult`, `sfx_heal`, `sfx_passed`, `sfx_lose`, `sfx_restart`,
  `sfx_level_intro`. New mechanics will need cues (launch, slide, teleport, switch, door, refill,
  swap, swamp step).
- Planned (step 2): master, music, and SFX gain buses for settings, mute, and pausing during portal
  ads.
