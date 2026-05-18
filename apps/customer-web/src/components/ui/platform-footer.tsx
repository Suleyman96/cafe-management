'use client';

import { useTranslation } from '@gustri/i18n';
import { useCafeSettings } from '@/hooks/use-settings';

interface PlatformFooterProps {
  className?: string;
}

export function PlatformFooter({ className = '' }: PlatformFooterProps) {
  const { t } = useTranslation('customer');
  const { data: settings } = useCafeSettings();
  const secondaryColor = settings?.brand_secondary_color || '#1E40AF';

  return (
    <div className={`text-center py-4 ${className}`}>
      <p className="text-xs text-muted-foreground/60">
        {t('tableLanding.poweredBy')}{' '}
        <span className="font-medium" style={{ color: secondaryColor }}>
          gustri
        </span>
      </p>
    </div>
  );
}
