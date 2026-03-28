interface GustriLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function GustriLogo({ size = 40, className = '', showText = true }: GustriLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Icon - Coffee cup with dashboard grid */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Cup body */}
        <path
          d="M8 16C8 14.8954 8.89543 14 10 14H32C33.1046 14 34 14.8954 34 16V34C34 38.4183 30.4183 42 26 42H16C11.5817 42 8 38.4183 8 34V16Z"
          fill="#3B82F6"
        />

        {/* Cup handle */}
        <path
          d="M34 18H36C39.3137 18 42 20.6863 42 24C42 27.3137 39.3137 30 36 30H34"
          stroke="#3B82F6"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Steam lines */}
        <path d="M14 10C14 10 15 8 14 6" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
        <path d="M21 10C21 10 22 7 21 4" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
        <path d="M28 10C28 10 29 8 28 6" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />

        {/* Dashboard grid inside cup */}
        <rect x="12" y="20" width="7" height="7" rx="1" fill="white" opacity="0.9" />
        <rect x="23" y="20" width="7" height="7" rx="1" fill="white" opacity="0.7" />
        <rect x="12" y="31" width="7" height="7" rx="1" fill="white" opacity="0.7" />
        <rect x="23" y="31" width="7" height="7" rx="1" fill="white" opacity="0.5" />
      </svg>

      {/* Text */}
      {showText && <span className="text-xl font-bold text-blue-600">Gustri</span>}
    </div>
  );
}

// Icon-only version for favicons
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
      {/* Cup body */}
      <path
        d="M8 16C8 14.8954 8.89543 14 10 14H32C33.1046 14 34 14.8954 34 16V34C34 38.4183 30.4183 42 26 42H16C11.5817 42 8 38.4183 8 34V16Z"
        fill="#3B82F6"
      />

      {/* Cup handle */}
      <path
        d="M34 18H36C39.3137 18 42 20.6863 42 24C42 27.3137 39.3137 30 36 30H34"
        stroke="#3B82F6"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Steam lines */}
      <path d="M14 10C14 10 15 8 14 6" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 10C21 10 22 7 21 4" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 10C28 10 29 8 28 6" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />

      {/* Dashboard grid inside cup */}
      <rect x="12" y="20" width="7" height="7" rx="1" fill="white" opacity="0.9" />
      <rect x="23" y="20" width="7" height="7" rx="1" fill="white" opacity="0.7" />
      <rect x="12" y="31" width="7" height="7" rx="1" fill="white" opacity="0.7" />
      <rect x="23" y="31" width="7" height="7" rx="1" fill="white" opacity="0.5" />
    </svg>
  );
}
