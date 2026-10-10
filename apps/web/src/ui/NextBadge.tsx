import { FinishIcon, NextIcon } from './icons';

export type NextBadgeProps = Readonly<{
  visible: boolean;
  /** True after the last level: a home/star badge that returns to the menu. */
  final: boolean;
  onActivate(): void;
}>;

/** Round badge shown after a win. The wrapper ignores the pointer so the board stays playable around it. */
export function NextBadge({ visible, final, onActivate }: NextBadgeProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="next-badge-layer">
      <button
        className={final ? 'next-badge next-badge--final' : 'next-badge'}
        type="button"
        data-action={final ? 'menu' : 'next'}
        aria-label={final ? 'Finish' : 'Next level'}
        onClick={onActivate}
      >
        {final ? <FinishIcon className="next-badge-icon" /> : <NextIcon className="next-badge-icon" />}
      </button>
    </div>
  );
}
