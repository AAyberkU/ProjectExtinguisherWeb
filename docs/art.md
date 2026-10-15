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
- Step 1 crops every original to its visible pixels, so a drawing delivered on a whole page still
  fills its texture. Images that replace or stack on each other are cropped together with one
  shared box so they stay aligned: the `alignedSets` table in `build-assets.mjs` lists them (today
  `obj_door_*` and `obj_switch_*`). Floor, start, and finish are cropped to the solid hex body.
- Board art (`images/tiles`, `images/objects`, table `BOARD_ART`) keeps the artist's relative
  scale: one factor comes from the floor (its hex width becomes 512 px @2x, about 0.515 for the A4
  pages) and applies to every page-sized drawing; start and finish are fitted to exactly the floor's
  size. Art on another canvas gets its own size (`obj_plus1`, 300 px wide, set by eye).
- Larry (`images/characters`) is fitted to 384 px tall; backgrounds to 1920 px wide. Artists can
  always deliver large originals.
- Step 2 runs AssetPack 1.7 (`pixiPipes`): tiles and Larry go into one atlas at @2x and @1x, images
  become WebP (quality 90) with a PNG fallback, audio becomes MP3 (SFX 96 kbps mono, music 128 kbps
  stereo), file names get cache-busting hashes, and a Pixi manifest is written.
- Manifest bundles: `game` (atlas), `ui` (background), `audio`. `apps/web/src/game/assets.ts`
  initializes Pixi `Assets`, prefers WebP at the render resolution, reports `game` bundle progress
  to the loading screen, and resolves other aliases to absolute URLs.
- Code references art only by alias (file name without extension), never by path.
- After the first art batch (2026-10-11) the @2x atlas is 1947x2367 (WebP about 440 KB) and the
  production build about 5.1 MB.
- Result on 2026-10-10: production build about 7 MB (was about 53 MB before the pipeline); a first
  gameplay load downloads about 2.3 MB (atlas @2x WebP about 820 KB, background 420 KB, audio about
  1.1 MB) plus the JS bundle.
- After each run the script deletes output files the manifest no longer references (AssetPack keeps
  outputs from earlier runs otherwise).
- A Steam asset profile with larger targets can be added later from the same originals.

## Naming

Aliases (the artist's first batch, 2026-10-11; Puzzle Lab vocabulary). Full tiles live in
`art-source/images/tiles/`, things drawn on top of the floor in `art-source/images/objects/`.
Colours: `a` blue, `b` pink, `c` green (editor colours 1, 2, 3).

| Alias | Use | Delivered as |
| --- | --- | --- |
| `tile_floor` | Every floor cell; seeded 60° rotations give variety | `duztile.png` |
| `tile_start`, `tile_finish` | Start and finish (full tiles) | `Baslangictile.png`, `bitistile.png` |
| `tile_swamp` | Semi-transparent slime drawn over the floor | `Slimetile.png` |
| `obj_blocker` | Wall: one kind only, on the floor | `Blocker.png` |
| `obj_plus1` | +1 on the floor; removed when collected | `Artibir.png` |
| `obj_launcher` | Duck, rotated to the launcher's direction (drawn heading about 237°, NW) | `ordek.png` |
| `obj_mover` | Car, rotated to the mover's direction (drawn heading about 238°, NW) | `Araba.png` |
| `obj_portal` | Portal; pairs 2 and 3 are hue-shifted in code (0/120/240°) | `Portal.png` |
| `obj_switch_<a\|b\|c>` | Switch; the pressed state is code (squashed to 62%, darker) | `Buton<mavi\|pembe\|yesil>.png` |
| `obj_door_<a\|b\|c>_<closed\|open>` | Door states | `Kapi...` files |
| `obj_passage_wall` | Crayon along each passage side closed both ways | `Pastelengel.png` |
| `larry` | Player character | `Larry.png` |
| `background` | Full-screen background (jam art) | |
| `music`, `sfx_<name>` | Audio (jam) | |

Without art (code-drawn in `apps/web/src/game/renderer/glyphs.ts`, preview at `/glyph-preview.html`):
refill, the swap marker, and one-way passage arrows.

## Artist checklist

Everything the artist (Ilgın) needs to draw, in one list (consolidated on 2026-10-10). The artist
draws static pieces only; code does every animation, the layout, all text (with a self-hosted font,
including the steps counter digits and refill numbers), dimming, glows, and placeholders. Until a
piece arrives the game uses a code-drawn placeholder, so no work waits for art; delivered art replaces
the placeholder by alias.

Delivery rules:

- Transparent PNG. Larger is always fine; the pipeline shrinks (`Asset pipeline` above).
- No cropping needed: whole-page exports are fine (Larry arrived as an A4 page, 4560x3224, and the
  pipeline crops it). Every state is its own file.
- Drawings that replace or stack on each other (door closed and open, switch up and pressed, a tile
  base and its object, Larry's poses) are exported from the same working file by showing one layer
  at a time, without moving the drawing or changing the canvas size, so they stay aligned.
- Tiles: **pointy-top** hexes (corners up and down), at least 512 px wide, on one shared tile canvas
  so every tile lines up. Layered (base hex, object, optional shadow) or flattened is decided near
  final art; keep layered sources either way.
- Larry: at least 384 px tall. Icons and UI pieces: at least 256 px.
- Background: at least 1920 px wide; it must work cropped to both landscape and portrait, so keep
  the important content near the centre.
- The artist sends files to Ayberk; the integrator names them and places them in `art-source/`.

### 1. Board and mechanics (required)

- [x] Floor (one tile; variety from rotation, decided 2026-10-11).
- [x] Wall (blocker): one kind only (three look-alike variants were confusing, decided 2026-10-11).
- [x] Start and finish.
- [x] `plus1` (+1 step pickup). Delivered on a different canvas; its size is set by eye.
- [x] Launcher (one duck, rotated in code to the 6 directions).
- [x] Swamp (semi-transparent; drawn over the floor for now, the artist may revisit).
- [x] Mover (one car, rotated in code to the 6 directions).
- [ ] Portal: delivered once; pairs are hue-shifted in code for now. Real colourways per pair (up to
  3 pairs in one level) would look better.
- [ ] Switch, 3 colours: up states delivered; the pressed state is code for now (drawn would be better).
- [x] Door, 3 colours, closed and open. (The blue one has low contrast on the purple floor.)
- [ ] Passage: closed side delivered (crayon); one-way side still needs one arrow drawing (code arrow
  for now).
- [ ] Refill: a plain base; the number (1-99) is drawn in code on top.
- [ ] Swap: a marker that shows which cells are paired.
- [x] Larry.
- [ ] Background (landscape and portrait).

### 2. Screens and HUD (required, roadmap step 2)

- [ ] HUD icons: undo, restart, menu, music on, music off, SFX on, SFX off (7 icons).
- [ ] One shared button base (round or hex); the pressed state is done in code.
- [ ] Level card: card base, lock icon, completed tick. Code combines them into the open, locked,
  and completed states.
- [ ] Level select panel: frame, page arrows, close button (the credits box reuses the frame).
- [ ] Game logo ("Project Extinguisher") for the main menu.
- [ ] "Next" arrow badge shown after a win, and a "finish" variant for the last level.

### 3. Optional (the game works without them)

- [ ] Celebration particles (water drops, foam, sparks); code multiplies and moves them.
- [ ] Larry happy and sad poses, in layers. Without them, code animates the existing Larry.
- [ ] Finish tile "reached" state for the win celebration.
- [ ] A plate behind the large steps counter.
- [ ] A main menu background. Without it, the game background is reused.

### 4. Release (later, before each store launch)

- [ ] Game icon for the browser tab and PWA install (square; the integrator makes the sizes).
- [ ] Coolmath Games promotional thumbnails; exact sizes come with the submission requirements.
- [ ] Steam store capsules and library art (roadmap step 6).

## Board presentation

- Every blocker is drawn, including the walls that pad large boards: the floor tile with the cube on
  top, one kind only.
- Floor cells use one tile with a seeded rotation in 60° steps (seeded by level id and cell, so a
  level always looks the same). The floor's bevel is lit evenly, so rotation keeps lighting
  consistent.
- Objects sit on the floor, centred, at the size the artist drew them relative to the floor.
- Board size varies per level (19 to 91 cells); the board scales to fit. If 91-cell boards look too
  busy on phones, edge walls may be drawn quieter (gameplay is unaffected because walls and edges
  behave the same).
- The board art is pointy-top; the old 30° placeholder rotation is gone. Larry is drawn at about
  0.75 of a tile's height (`LARRY_SPRITE_HEIGHT` in `boardView.ts`).

## Code animation

Two layers of animation, both driven only by engine events (rules never wait on animation):

1. **Mechanic motion** (done in step 1): walk hop 160 ms, launch arc 240 ms, car ride 90 ms per cell
   (the car drives with Larry and stays parked; parked cars are darkened in code, 2026-10-16),
   teleport 220 ms, swap exchange 180 ms, pickups 260 ms, door and switch fades 200 ms, level intro
   (tiles drop by diagonal lines, then Larry appears). Constants live in
   `apps/web/src/game/renderer/boardView.ts`.
2. **Polish / juice** (roadmap step 4, grows with art): launcher object stretch on launch, `plus1`
   and refill pickups lifting off and fading with a number pop, walls dropping in during the intro,
   portal pull and glow, door opening on a switch press, swap exchange effect, Larry shadow and
   squash, idle breathing, menu transitions.
3. **Outcome and tutorial effects** (done in step 2, `renderer/effects.ts`, `renderer/hintGlow.ts`):
   win celebration (Larry hop and spin, particle fountain, finish glow; a bigger version on the last
   level), stuck loss (shake, red ring, dim), out-of-steps loss (slump, grey, dim), tutorial glow.
   Reduced motion has calmer versions. Preview in dev at `/fx-preview.html?level=N`.

Art seams for the step 2 placeholders: particle sprites by alias `fx_drop`, `fx_foam`, `fx_spark`
(used automatically when present); CSS custom properties `--hud-button-image`, `--next-badge-image`,
`--menu-logo-image` (with `.menu-logo--image`), and the level select `--level-card-*` and `--menu-*`
properties and class hooks.

The prerequisites are in place since step 1: persistent tile objects and an event-driven timeline.
Richer per-object effects need layered art.

## Audio

- `apps/web/src/game/audio.ts` resolves the `audio` manifest aliases after asset initialization.
- Music: looping `HTMLAudioElement`, volume 0.4, starts on mount and retries on the first pointer or
  key input if autoplay is blocked.
- SFX: fetched and decoded into Web Audio buffers up front, with an HTMLAudio fallback; played by
  the animation timeline when each event's animation starts.
- Current mapping: walk `sfx_jump`, launch `sfx_catapult`, +1 and refill `sfx_heal`, win
  `sfx_passed`, loss `sfx_lose`, restart `sfx_restart`, level intro `sfx_level_intro`. Slide,
  teleport, swap, switch, door, and swamp steps are silent until cues exist.
- Music and SFX on/off toggles in the HUD (saved; keys `M` and `V`). `setSuspended` mutes both for
  future portal ad breaks without changing the toggles. New cues for win, loss, and buttons are
  decided later.
