import { useState } from 'react';

export type MainMenuProps = Readonly<{
  hasProgress: boolean;
  onPlay(): void;
  onLevelSelect(): void;
}>;

export function MainMenu({ hasProgress, onPlay, onLevelSelect }: MainMenuProps) {
  const [creditsOpen, setCreditsOpen] = useState(false);

  return (
    <section className="main-menu" aria-label="Main menu">
      {/* Placeholder title; the artist's logo replaces it through --menu-logo-image and .menu-logo--image (_menus.scss). */}
      <h1 className="menu-logo">Project Extinguisher</h1>
      <nav className="menu-buttons">
        <button className="menu-button menu-play" type="button" data-action="play" onClick={onPlay}>
          {hasProgress ? 'Continue' : 'Play'}
        </button>
        <button className="menu-button menu-levels" type="button" data-action="levels" onClick={onLevelSelect}>
          Level Select
        </button>
        <button
          className="menu-button menu-credits"
          type="button"
          data-action="credits"
          aria-expanded={creditsOpen}
          onClick={() => setCreditsOpen((open) => !open)}
        >
          Credits
        </button>
      </nav>

      {creditsOpen ? (
        <div className="menu-credits-box" role="group" aria-label="Credits">
          <p className="credit-role">Artist</p>
          <p className="credit-name credit-name--artist">Elif Ilgin Tilev</p>
          <p className="credit-role">Designer</p>
          <p className="credit-name credit-name--designer">Defne Gurcu</p>
          <p className="credit-role">Developer</p>
          <p className="credit-name credit-name--developer">Ahmet Ayberk Uzun</p>
          <p className="credit-role">Music</p>
          <p className="credit-name credit-name--music">Onurhan Karabag</p>
          <button className="menu-credits-close" type="button" onClick={() => setCreditsOpen(false)}>
            Close
          </button>
        </div>
      ) : null}
    </section>
  );
}
