"use client";

import { useCafeSettings } from "@/hooks/use-settings";

interface PlatformFooterProps {
  className?: string;
}

export function PlatformFooter({ className = "" }: PlatformFooterProps) {
  const { data: settings } = useCafeSettings();
  const secondaryColor = settings?.brand_secondary_color || "#1E40AF";

  return (
    <div className={`text-center py-4 ${className}`}>
      <p className="text-xs text-muted-foreground/60">
        Powered by{" "}
        <span className="font-medium" style={{ color: secondaryColor }}>
          Cafe-Man
        </span>
      </p>
    </div>
  );
}
