# Bugs & Risks

## Confirmed Bugs

- None currently confirmed.

## Open Technical Risks

- Browser autoplay policy may block music until first user interaction despite the app attempting playback on initial mount.
- Each SFX is still downloaded twice: once for the Web Audio buffer and once for the preloaded HTMLAudio fallback (about 100 KB total).
- Mobile layout, main menu sizing, completion overlays, and touch input have not been validated yet.
- Pixi rendering scale, camera framing, responsive board fit, Unity-matched vertical map orientation, HUD overlap, animation feel, and audio timing are still untested in browser.
- Core reducer is implemented but not yet covered by automated unit tests; add focused tests once the first JSON level is introduced.
- Five-level interactive state is wired, but manual browser gameplay parity still needs validation for click movement, win/loss, reset, manual next-level, and return-to-menu flow.
- Catapult directional art is selected from on-screen `catapultDirection` names after the pointy-top board rotation; launch direction versus the rotated placeholder art still needs manual validation in Levels 3-5.
- Initial production build passes, but Vite warns that the Pixi-driven app chunk is larger than 500 KB after minification. Monitor bundle size and consider code splitting or asset optimization later.
- Backend should remain out of scope unless leaderboard, analytics, accounts, replays, or community levels are approved.

## Fixed

- Replaced direct imports of full-size PNG/WAV files with the `npm run assets` pipeline. The production build dropped from about 53 MB to 4.7 MB, and a first gameplay load now downloads about 2 MB (atlas, background, audio) plus the JS bundle.
- Fixed intermittent cold-load startup behavior where the large background could remain on the pink fallback while gameplay appeared, slow tile delivery could leave a HUD-only screen, and one failed texture request could permanently prevent the Pixi canvas from mounting. Startup now waits for background and texture readiness, synchronizes the first intro cue with the mounted board, and exposes a Retry path for load failures.
- Replaced placeholder procedural tile fills with Unity-exported tile art sprites.
- Replaced Larry's placeholder marker with the Unity-exported Larry sprite.
- Converted Unity Levels 1-5 to JSON and removed the pending-level import risk.
- Corrected web axial-to-pixel rendering to match Unity scene `HexCell` indexing and world-position orientation.
- Replaced the temporary two-column bootstrap UI with a full-screen background, main menu, and gameplay HUD.
- Added manual completion overlays, Larry hop animation, and tile drop-in level intro animation.
- Sped up the web tile drop-in intro animation and fixed catapult movement to animate through the catapult tile instead of lerping directly to the final landing tile.
- Added looping music plus jump, catapult, heal, pass, lose, restart, and level-intro SFX wiring.
- Replaced per-play SFX `new Audio()` creation with Web Audio preload/decode playback to reduce intermittent sound delay.
- Fixed background music continually resetting to the beginning on every pointer/keyboard interaction.
