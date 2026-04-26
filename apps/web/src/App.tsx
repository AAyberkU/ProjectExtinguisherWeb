import { PixiStage } from './game/renderer/PixiStage';

export function App() {
  return (
    <main className="app-shell">
      <section className="hero-panel" aria-label="Project Extinguisher web bootstrap">
        <p className="eyebrow">Web Port Bootstrap</p>
        <h1>Project Extinguisher</h1>
        <p className="hero-copy">
          TypeScript, Pixi.js, Vite, React, SCSS, and JSON levels are ready for the first playable web slice.
        </p>
      </section>

      <section className="game-panel" aria-label="Pixi board preview">
        <PixiStage />
      </section>
    </main>
  );
}
