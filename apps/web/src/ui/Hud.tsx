import type { ReactNode, Ref } from 'react';
import type { LossReason } from '../game/engine';
import { MenuIcon, MusicOffIcon, MusicOnIcon, RestartIcon, SfxOffIcon, SfxOnIcon, UndoIcon } from './icons';

export type HudProps = Readonly<{
  levelLabel: string;
  levelId: string;
  steps: number;
  canUndo: boolean;
  music: boolean;
  sfx: boolean;
  /** Fades the HUD out (kept in layout so the board fit can still measure it). */
  hidden: boolean;
  /** 'out-of-steps' flashes the counter red; any loss makes Undo and Restart pulse. */
  lossReason: LossReason | null;
  onUndo(): void;
  onRestart(): void;
  onToggleMusic(): void;
  onToggleSfx(): void;
  onMenu(): void;
}>;

type HudButtonProps = Readonly<{
  className: string;
  label: string;
  onClick(): void;
  disabled?: boolean;
  pressed?: boolean;
  pulse?: boolean;
  /** The level select restores focus to its opener, so the Menu button keeps it after a click. */
  keepFocus?: boolean;
  children: ReactNode;
}>;

function HudButton({ className, label, onClick, disabled, pressed, pulse, keepFocus, children }: HudButtonProps) {
  return (
    <button
      className={`hud-button ${className}`}
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      data-pulse={pulse === true ? 'true' : undefined}
      onClick={(event) => {
        onClick();

        // A pointer click must not leave the button focused (a later Enter would activate it); Tab focus is kept.
        if (event.detail > 0 && !keepFocus) {
          event.currentTarget.blur();
        }
      }}
    >
      {children}
    </button>
  );
}

export function Hud({
  ref,
  levelLabel,
  levelId,
  steps,
  canUndo,
  music,
  sfx,
  hidden,
  lossReason,
  onUndo,
  onRestart,
  onToggleMusic,
  onToggleSfx,
  onMenu,
}: HudProps & Readonly<{ ref?: Ref<HTMLElement> }>) {
  const lost = lossReason !== null;

  return (
    <header
      ref={ref}
      className={hidden ? 'game-hud game-hud--hidden' : 'game-hud'}
      aria-label="Game HUD"
      data-level-id={levelId}
      data-steps={steps}
    >
      <div className="hud-left">
        <p className="hud-level">{levelLabel}</p>
        <div className="hud-group">
          <HudButton className="hud-undo" label="Undo last move" onClick={onUndo} disabled={!canUndo} pulse={lost && canUndo}>
            <UndoIcon />
          </HudButton>
          <HudButton className="hud-restart" label="Restart level" onClick={onRestart} pulse={lost}>
            <RestartIcon />
          </HudButton>
        </div>
      </div>

      <p
        className="hud-steps"
        role="status"
        aria-label={`Steps left: ${steps}`}
        data-low={lossReason === 'out-of-steps' ? 'true' : undefined}
      >
        {steps}
      </p>

      <div className="hud-group hud-right">
        <HudButton className="hud-music" label="Music" pressed={music} onClick={onToggleMusic}>
          {music ? <MusicOnIcon /> : <MusicOffIcon />}
        </HudButton>
        <HudButton className="hud-sfx" label="Sound effects" pressed={sfx} onClick={onToggleSfx}>
          {sfx ? <SfxOnIcon /> : <SfxOffIcon />}
        </HudButton>
        <HudButton className="hud-menu" label="Menu" keepFocus onClick={onMenu}>
          <MenuIcon />
        </HudButton>
      </div>
    </header>
  );
}
