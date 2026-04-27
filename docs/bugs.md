# Bugs & Risks

## Confirmed Bugs

- None currently confirmed.

## Open Technical Risks

- Web asset optimization strategy is not defined yet; imported PNG tiles are large and should be compressed or atlased later.
- Mobile layout, main menu sizing, completion overlays, and touch input have not been validated yet.
- Pixi rendering scale, camera framing, responsive board fit, Unity-matched vertical map orientation, HUD overlap, and animation feel are still untested in browser.
- Core reducer is implemented but not yet covered by automated unit tests; add focused tests once the first JSON level is introduced.
- Five-level interactive state is wired, but manual browser gameplay parity still needs validation for click movement, win/loss, reset, manual next-level, and return-to-menu flow.
- Catapult directional art is selected from `catapultDirection`, but launch direction versus visual art still needs manual validation in Levels 3-5.
- Initial production build passes, but Vite warns that the Pixi-driven app chunk is larger than 500 KB after minification. Monitor bundle size and consider code splitting or asset optimization later.
- Backend should remain out of scope unless leaderboard, analytics, accounts, replays, or community levels are approved.

## Fixed

- Replaced placeholder procedural tile fills with Unity-exported tile art sprites.
- Replaced Larry's placeholder marker with the Unity-exported Larry sprite.
- Converted Unity Levels 1-5 to JSON and removed the pending-level import risk.
- Corrected web axial-to-pixel rendering to match Unity scene `HexCell` indexing and world-position orientation.
- Replaced the temporary two-column bootstrap UI with a full-screen background, main menu, and gameplay HUD.
- Added manual completion overlays, Larry hop animation, and tile drop-in level intro animation.
- Sped up the web tile drop-in intro animation and fixed catapult movement to animate through the catapult tile instead of lerping directly to the final landing tile.
