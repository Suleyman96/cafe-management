'use client';

import type { LucideIcon } from 'lucide-react';
import { CheckCircle2 } from 'lucide-react';

interface StatusStep {
  key: string;
  label: string;
  icon: LucideIcon;
}

interface OrderTimelineProps {
  steps: StatusStep[];
  currentStatus: string;
  inProgressLabel: string;
  isOrderCompleted?: boolean;
}

export function OrderTimeline({
  steps,
  currentStatus,
  inProgressLabel,
  isOrderCompleted = false,
}: OrderTimelineProps) {
  const currentStepIndex = steps.findIndex((step) => step.key === currentStatus);

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const isActive = !isOrderCompleted && index === currentStepIndex;
        const isCompleted = isOrderCompleted || index < currentStepIndex;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-center gap-4">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : isCompleted
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className={`font-medium ${isActive ? 'text-primary' : ''}`}>{step.label}</p>
              {isActive && <p className="text-sm text-muted-foreground">{inProgressLabel}</p>}
            </div>
            {isCompleted && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          </div>
        );
      })}
    </div>
  );
}
