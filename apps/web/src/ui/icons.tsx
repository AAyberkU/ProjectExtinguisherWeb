// Placeholder inline-SVG icons. Real art replaces them by alias (docs/art.md, "UI art").
import type { ReactNode } from 'react';

type IconProps = Readonly<{ className?: string }>;

function Icon({ className, children }: Readonly<{ className?: string; children: ReactNode }>) {
  return (
    <svg
      className={className === undefined ? 'icon' : `icon ${className}`}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const UndoIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Icon>
);

export const RestartIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v5h-5" />
  </Icon>
);

export const MenuIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const MusicOnIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </Icon>
);

export const MusicOffIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
    <path d="M3 3l18 18" />
  </Icon>
);

export const SfxOnIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M4 9.5v5h4l5 4v-13l-5 4H4Z" />
    <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" />
  </Icon>
);

export const SfxOffIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M4 9.5v5h4l5 4v-13l-5 4H4Z" />
    <path d="M17 9.5l4 5M21 9.5l-4 5" />
  </Icon>
);

export const NextIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

/** Home with a star: the badge after the final level. */
export const FinishIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M4 11 12 4l8 7v9H4Z" />
    <path d="m12 10 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4Z" />
  </Icon>
);

export const LockIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const TickIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);
