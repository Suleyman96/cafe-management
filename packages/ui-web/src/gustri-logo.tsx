interface LogoProps {
  size?: number;
  className?: string;
  variant?: 'color' | 'dark' | 'light';
}

interface LogoFullProps extends LogoProps {
  showText?: boolean;
}

const BRAND = '#367B8B';

/**
 * Full lockup: logomark + "gustri" wordmark.
 */
export function GustriLogo({
  size = 40,
  className = '',
  showText = true,
  variant = 'color',
}: LogoFullProps) {
  const textColor = variant === 'dark' ? '#FFFFFF' : variant === 'light' ? '#1A1A1A' : BRAND;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <GustriIcon size={size} variant={variant} />
      {showText && (
        <span
          className="font-bold tracking-tight"
          style={{ fontSize: size * 0.55, color: textColor, letterSpacing: '-0.02em' }}
        >
          gustri
        </span>
      )}
    </div>
  );
}

/**
 * Logomark: full circle bowl + diagonal ear + separate half-circle descender.
 * No connecting stem — circle and half-circle are visually separated.
 */
export function GustriIcon({ size = 32, className = '', variant = 'color' }: LogoProps) {
  const hasBg = variant === 'color';
  const bg = BRAND;
  const mark = variant === 'dark' ? '#FFFFFF' : variant === 'light' ? '#1A1A1A' : '#FFFFFF';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Gustri logo"
    >
      {hasBg && <rect width="512" height="512" rx="112" fill={bg} />}

      {/* Bowl: full circle */}
      <circle cx="248" cy="172" r="95" stroke={mark} strokeWidth="50" fill="none" />

      {/* Ear: diagonal from top-right of circle */}
      <line
        x1="340"
        y1="148"
        x2="368"
        y2="114"
        stroke={mark}
        strokeWidth="50"
        strokeLinecap="round"
      />

      {/* Descender: separate half-circle, no stem */}
      <path
        d="M 343 345 A 95 95 0 0 1 153 345"
        stroke={mark}
        strokeWidth="50"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
