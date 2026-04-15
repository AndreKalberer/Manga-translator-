'use client';

import { QuotaInfo } from '@/types';

interface QuotaBadgeProps {
  quota: QuotaInfo | null;
}

function formatResetTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function QuotaBadge({ quota }: QuotaBadgeProps) {
  if (!quota) return null;

  const { remaining, limit } = quota;
  const exhausted = remaining === 0;
  const low = remaining === 1;

  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
        exhausted
          ? 'bg-red-50 border-red-200 text-red-600'
          : low
            ? 'bg-amber-50 border-amber-200 text-amber-600'
            : 'bg-gray-100 border-gray-200 text-gray-500'
      }`}
      title={exhausted ? `Resets at ${formatResetTime(quota.resetAt)}` : undefined}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          exhausted ? 'bg-red-500' : low ? 'bg-amber-400' : 'bg-green-400'
        }`}
      />
      {exhausted ? (
        <span>Limit reached · resets {formatResetTime(quota.resetAt)}</span>
      ) : (
        <span>
          {remaining}/{limit} left today
        </span>
      )}
    </div>
  );
}
