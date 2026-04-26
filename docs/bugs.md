# Bugs & Risks

## Confirmed Bugs

- None currently confirmed.

## Open Technical Risks

- Unity `LevelData.asset` to JSON conversion has not been implemented yet.
- Web asset optimization strategy is not defined yet.
- Mobile layout and touch input have not been validated yet.
- Pixi rendering scale, camera framing, and responsive board fit are still untested.
- Core reducer is implemented but not yet covered by automated unit tests; add focused tests once the first JSON level is introduced.
- Core reducer is not yet wired into React/Pixi interactive state, so browser gameplay parity still needs validation.
- Initial production build passes, but Vite warns that the Pixi-driven app chunk is larger than 500 KB after minification. Monitor bundle size and consider code splitting or asset optimization later.
- Backend should remain out of scope unless leaderboard, analytics, accounts, replays, or community levels are approved.

## Fixed

- None yet.
