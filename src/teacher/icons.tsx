// Inline icons. They inherit the text colour and size from their button.

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg
    className="icon"
    viewBox="0 0 24 24"
    width="1.25em"
    height="1.25em"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const PersonIcon = () => (
  <Svg>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);

export const GroupIcon = () => (
  <Svg>
    <circle cx="9" cy="8" r="3.5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M2 20a7 7 0 0 1 14 0M16 14a5 5 0 0 1 6 6" />
  </Svg>
);

export const GridIcon = () => (
  <Svg>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Svg>
);

export const ChatIcon = () => (
  <Svg>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />
  </Svg>
);

export const SpotlightIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
  </Svg>
);

export const PulseIcon = () => (
  <Svg>
    <path d="M3 12h4l3-8 4 16 3-8h4" />
  </Svg>
);

export const CheckIcon = () => (
  <Svg>
    <path d="m5 12 5 5 9-10" />
  </Svg>
);

export const WheelIcon = () => (
  <Svg>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 13V5M12 13l6.9 4M12 13l-6.9 4M10 2h4l-2 3z" />
  </Svg>
);

export const ResetIcon = () => (
  <Svg>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Svg>
);

export const BlankIcon = () => (
  <Svg>
    <rect x="2" y="4" width="20" height="13" rx="2" fill="currentColor" />
    <path d="M8 21h8M12 17v4" />
  </Svg>
);

// Copy, after Lucide (lucide.dev), ISC licence.
export const CopyIcon = () => (
  <Svg>
    <rect x="8" y="8" width="14" height="14" rx="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Svg>
);

export const SendIcon = () => (
  <Svg>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Svg>
);

export const RulesIcon = () => (
  <Svg>
    <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
  </Svg>
);

export const QrIcon = () => (
  <Svg>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
  </Svg>
);

export const HandIcon = () => (
  <Svg>
    <path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L6 14" />
  </Svg>
);

export const KeyboardIcon = () => (
  <Svg>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M10 13h4M7 16h10" />
  </Svg>
);

export const ClassIcon = () => (
  <Svg>
    <path d="M3 5h18v10H3zM8 19h8M12 15v4" />
  </Svg>
);

export const SearchIcon = () => (
  <Svg>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </Svg>
);
