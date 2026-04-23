'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdUnitProps {
  slot: string;
  format?: 'auto' | 'rectangle' | 'horizontal';
  className?: string;
}

export default function AdUnit({ slot, format = 'auto', className = '' }: AdUnitProps) {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded yet
    }
  }, [clientId]);

  if (!clientId) {
    // In production, render nothing rather than a "Ad · slot" placeholder
    // — placeholders ship to real users when the env var is forgotten.
    // In dev, the placeholder is useful for layout debugging.
    if (process.env.NODE_ENV === 'production') return null;
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400 text-xs ${className}`}
      >
        Ad · {slot}
      </div>
    );
  }

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={clientId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
