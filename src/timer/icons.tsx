// Timer icons. They inherit the text colour and size from their button.

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

export const ClockIcon = () => (
  <Svg>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2 2M10 2h4" />
  </Svg>
);

export const PauseIcon = () => (
  <Svg>
    <path d="M9 5v14M15 5v14" />
  </Svg>
);

export const PlayIcon = () => (
  <Svg>
    <path d="M7 4l13 8-13 8z" />
  </Svg>
);

export const EyeIcon = () => (
  <Svg>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const EyeOffIcon = () => (
  <Svg>
    <path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.4 3.3M6.6 6.6C3.6 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Svg>
);
