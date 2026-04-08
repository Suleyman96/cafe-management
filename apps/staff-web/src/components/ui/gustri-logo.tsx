interface GustriLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function GustriLogo({ size = 40, className = '', showText = true }: GustriLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <GustriIcon size={size} />
      {showText && (
        <span className="text-xl font-bold tracking-wide text-[#367B8B]">gustri</span>
      )}
    </div>
  );
}

// Icon-only version for favicons and compact spaces
export function GustriIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Rounded square background */}
      <rect x="2" y="2" width="44" height="44" rx="12" fill="#367B8B" />

      {/* Modern lowercase "g" letterform */}
      <path
        d="M 30 10 A 10 10 0 1 0 30 26 L 30 36 Q 30 42 22 42 Q 14 42 14 36"
        stroke="white"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
