import React from 'react';

type IconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
};

const sharedProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
};

function createIcon(path: React.ReactNode) {
  return function Icon({ size = 20, strokeWidth = 1.6, className }: IconProps) {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        strokeWidth={strokeWidth}
        {...sharedProps}
      >
        {path}
      </svg>
    );
  };
}

export const SearchIcon = createIcon(
  <>
    <circle cx="11" cy="11" r="6" />
    <line x1="20" y1="20" x2="16.65" y2="16.65" />
  </>
);

export const Wand2Icon = createIcon(
  <>
    <path d="M5 3 3 5l16 16 2-2Z" />
    <path d="m9 7 6 6" />
    <path d="M8 3V1" />
    <path d="M16 3V1" />
    <path d="M12 5V3" />
  </>
);

export const BookOpenIcon = createIcon(
  <>
    <path d="M3 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H3Z" />
    <path d="M21 4h-7a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h7Z" />
  </>
);

export const SparklesIcon = createIcon(
  <>
    <path d="M12 3.5 13.2 8l3.3 1.7-3.3 1.7L12 16l-1.2-4.6L7.5 9.7 10.8 8Z" />
    <path d="M5 6.5 5.6 9l1.9.9-1.9.9L5 14l-.6-3.2L2.5 9.9 4.4 9Z" />
    <path d="m19 10 1.1 2.4 2.4 1.1-2.4 1.1L19 17l-1.1-2.4-2.4-1.1 2.4-1.1Z" />
  </>
);

export const BellIcon = createIcon(
  <>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </>
);

export const AlertCircleIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </>
);

export const CalendarIcon = createIcon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </>
);

export const BarChartIcon = createIcon(
  <>
    <line x1="3" y1="3" x2="3" y2="21" />
    <line x1="3" y1="19" x2="21" y2="19" />
    <rect x="7" y="11" width="3" height="8" rx="1" />
    <rect x="13" y="7" width="3" height="12" rx="1" />
    <rect x="19" y="4" width="3" height="15" rx="1" />
  </>
);

export const UserIcon = createIcon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M6 20c1.6-3 4-4.5 6-4.5s4.4 1.5 6 4.5" />
  </>
);

export const SettingsIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </>
);

export const LightningBoltIcon = createIcon(
  <>
    <polyline points="13 2 3 14 12 14 11 22 21 10 13 10" />
  </>
);

export const NotebookIcon = createIcon(
  <>
    <rect x="7" y="3" width="12" height="18" rx="2" />
    <path d="M9 3v18" />
    <path d="M7 7H5" />
    <path d="M7 12H5" />
    <path d="M7 17H5" />
    <path d="M11 9h6" />
    <path d="M11 13h4" />
    <path d="M11 17h3" />
  </>
);

export const BrainIcon = createIcon(
  <>
    <path d="M7 14C5.343 14 4 15.343 4 17s1.343 3 3 3c.3506 0 .6872-.0602 1-.1707" />
    <path d="M4.2639 15.6046C2.9243 14.9582 2 13.587 2 12c0-1.2117.5388-2.2975 1.3898-3.031" />
    <path d="M3.4205 8.8882C3.1549 8.4911 3 8.0136 3 7.5 3 6.1193 4.1193 5 5.5 5c.5629 0 1.0824.186 1.5002.5" />
    <path d="M7.2377 5.5653C7.0852 5.2421 7 4.881 7 4.5 7 3.1193 8.1193 2 9.5 2 10.8807 2 12 3.1193 12 4.5V20" />
    <path d="M8 20c0 1.1046.8954 2 2 2s2-.8954 2-2" />
    <path d="M12 5.5c2.4 0 4.5 2 4.5 4.4 0 .9-.3 1.8-.8 2.5" />
    <path d="M15.7 12.4C17.1 13.1 18 14.5 18 16c0 2.2-1.8 4-4 4h-2" />
    <path d="M12.4 10h1.1a2 2 0 0 1 0 4h-.7" />
  </>
);

export const BrainCircuitIcon = createIcon(
  <>
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
    <path d="M9 13a4.5 4.5 0 0 0 3-4" />
    <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
    <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
    <path d="M6 18a4 4 0 0 1-1.967-.516" />
    <path d="M12 13h4" />
    <path d="M12 18h6a2 2 0 0 1 2 2v1" />
    <path d="M12 8h8" />
    <path d="M16 8V5a2 2 0 0 1 2-2" />
    <circle cx="16" cy="13" r="1" />
    <circle cx="18" cy="3" r="1" />
    <circle cx="20" cy="21" r="1" />
    <circle cx="20" cy="8" r="1" />
  </>
);

export const PencilIcon = createIcon(
  <>
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497Z" />
    <path d="m15 5 4 4" />
  </>
);

export const GradesIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.75 16 12 7l3.25 9" />
    <path d="M10.25 12.25h3.5" />
    <path d="M16.5 10.25h3" />
    <path d="M18 8.75v3" />
  </>
);

export const MoonIcon = createIcon(
  <>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </>
);

export const SunIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </>
);

export const BookIcon = BookOpenIcon;
export type IconComponent = React.ComponentType<IconProps>;
