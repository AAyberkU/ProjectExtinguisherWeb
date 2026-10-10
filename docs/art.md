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
- Step 1 resizes each original with sharp to its group's @2x target: `images/tiles` 512 px wide,
  `images/characters` 384 px tall, `images/backgrounds` 1920 px wide (tiles and Larry were raised
  from 256/192 so small boards, which are scaled up, stay sharp). Artists can always deliver
  large originals.
- Step 2 runs AssetPack 1.7 (`pixiPipes`): tiles and Larry go into one atlas at @2x and @1x, images
  become WebP (quality 90) with a PNG fallback, audio becomes MP3 (SFX 96 kbps mono, music 128 kbps
  stereo), file names get cache-busting hashes, and a Pixi manifest is written.
- Manifest bundles: `game` (atlas), `ui` (background), `audio`. `apps/web/src/game/assets.ts`
  initializes Pixi `Assets`, prefers WebP at the render resolution, reports `game` bundle progress
  to the loading screen, and resolves other aliases to absolute URLs.
- Code references art only by alias (file name without extension), never by path.
- Result on 2026-10-10: production build about 7 MB (was about 53 MB before the pipeline); a first
  gameplay load downloads about 2.3 MB (atlas @2x WebP about 820 KB, background 420 KB, audio about
  1.1 MB) plus the JS bundle.
- After each run the script deletes output files the manifest no longer references (AssetPack keeps
  outputs from earlier runs otherwise).
- A Steam asset profile with larger targets can be added later from the same originals.

## Naming

Current aliases (jam placeholders, Puzzle Lab vocabulary):

| Alias | Use |
| --- | --- |
| `tile_floor_01` .. `tile_floor_10` | Floor variants |
| `tile_blocker_01` .. `tile_blocker_03` | Wall (blocker) variants |
| `tile_launcher_<dir>` | Launcher, one per direction: `e`, `se`, `sw`, `w`, `nw`, `ne` (the art faces that screen direction) |
| `tile_start`, `tile_finish`, `tile_plus1` | Start, finish, +1 |
| `larry` | Player character |
| `background` | Full-screen background |
| `music`, `sfx_<name>` | Audio |

New mechanic art should follow the same pattern, for example `tile_swamp`, `tile_mover_<dir>`,
`tile_portal`, `tile_switch_<a|b|c>`, `tile_door_<a|b|c>`. Mechanics without art use code-drawn glyphs
from `apps/web/src/game/renderer/glyphs.ts` (preview in dev at `/glyph-preview.html`).

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

## UI art (roadmap step 2)

Split agreed on 2026-10-10: the artist draws static pieces; code does every animation, the layout,
all text (with a self-hosted font, including the steps counter digits), dimming, tutorial glows, and
placeholders. Step 2 starts with code-drawn placeholders, so it never waits for art; delivered art
replaces them by alias.

Needed from the artist (transparent PNG, icons at least 256 px; the integrator names them):

1. HUD icons: undo, restart, menu, music on, music off, SFX on, SFX off (7 icons).
2. One shared button base (round or hex). The pressed state is done in code.
3. Level card: card base, lock icon, completed tick. Code combines them into the open, locked, and
   completed states.
4. Level select panel: frame, page arrows, close button.
5. Game logo ("Project Extinguisher") for the main menu.
6. "Next" arrow badge shown after a win.

Optional (later is fine):

- Celebration particles (water drops, foam, sparks); code multiplies and moves them.
- Larry happy and sad poses in layers. Without them, code animates the existing Larry (hop, shake).
- A main menu background. Without it, the game background is reused.

## Board presentation

- Every blocker is drawn, including the walls that pad large boards. Each wall picks one of the
  blocker variants with a seeded choice from the level id and cell coordinates, so a level always
  looks the same and walls never change between moves.
- Board size varies per level (19 to 91 cells); the board scales to fit. If 91-cell boards look too
  busy on phones, edge walls may be drawn quieter (gameplay is unaffected because walls and edges
  behave the same).
- Current placeholder art is the flat-top jam art rotated 30 degrees in `renderer/layout.ts`
  (`PLACEHOLDER_TILE_ROTATION`); set it to 0 when pointy-top art arrives.

## Code animation

Two layers of animation, both driven only by engine events (rules never wait on animation):

1. **Mechanic motion** (done in step 1): walk hop 160 ms, launch arc 240 ms, slide 90 ms per cell,
   teleport 220 ms, swap exchange 180 ms, pickups 260 ms, door and switch fades 200 ms, level intro
   (tiles drop by diagonal lines, then Larry appears). Constants live in
   `apps/web/src/game/renderer/boardView.ts`.
2. **Polish / juice** (roadmap step 4, grows with art): launcher object stretch on launch, `plus1`
   and refill pickups lifting off and fading with a number pop, walls dropping in during the intro,
   portal pull and glow, door opening on a switch press, swap exchange effect, Larry shadow and
   squash, idle breathing, win and fail effects, menu transitions.

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
- Planned (step 2): music and SFX on/off toggles in the HUD (saved), on gain buses that portal ad
  breaks can also mute. New cues for win, loss, and buttons are decided later.
