interface RecurLogoWordmarkProps {
  height?: number;
  className?: string;
}

export function RecurLogoWordmark({
  height = 32,
  className = "",
}: RecurLogoWordmarkProps) {
  const width = Math.round((400 / 120) * height);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 120"
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="purpleGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#C084FC" />
        </linearGradient>
        <linearGradient id="greenGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#14F195" />
        </linearGradient>
        <filter id="glow2" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <g transform="translate(10, 0)">
        <path
          d="M 30 102 L 30 26 C 30 20.477 34.477 16 40 16 L 60 16 C 76.569 16 90 29.431 90 46 C 90 62.569 76.569 76 60 76 L 30 76"
          fill="none"
          stroke="url(#purpleGrad2)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 50 76 L 72 98"
          fill="none"
          stroke="url(#purpleGrad2)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <circle
          cx="76"
          cy="102"
          r="10"
          fill="url(#greenGrad2)"
          filter="url(#glow2)"
        />
      </g>
      <text
        x="130"
        y="86"
        fontFamily="'Inter', -apple-system, sans-serif"
        fontWeight="800"
        fontSize="76"
        fill="#F8F8FF"
        letterSpacing="-0.04em"
      >
        Recur
      </text>
    </svg>
  );
}
