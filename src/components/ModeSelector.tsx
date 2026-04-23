import type { Mode } from '@/types';
import type { ReactNode } from 'react';

interface ModeOption {
  value: Mode;
  title: string;
  description: string;
  cost: 1 | 2;
  icon: ReactNode;
}

const iconBase = 'w-4 h-4';

const OPTIONS: ModeOption[] = [
  {
    value: 'translate',
    title: 'Translate',
    description: 'English text in speech bubbles',
    cost: 1,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={iconBase}>
        <path d="M4 5h12" />
        <path d="M10 3v2" />
        <path d="M6 19 12 5l4 9" />
        <path d="M8 14h8" />
        <path d="M16 21l5-10 3 6" />
        <path d="M17 17h5" />
      </svg>
    ),
  },
  {
    value: 'color',
    title: 'Colorize',
    description: 'Add vibrant color to B&W panels',
    cost: 1,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={iconBase}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="8" cy="9" r="1" fill="currentColor" stroke="none" />
        <circle cx="12.5" cy="7" r="1" fill="currentColor" stroke="none" />
        <circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
        <path d="M15 15a2.5 2.5 0 0 1-2.5 2.5 2 2 0 0 1 0-4 2 2 0 0 0 0-4" />
      </svg>
    ),
  },
  {
    value: 'both',
    title: 'Both',
    description: 'Translate and colorize together',
    cost: 2,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={iconBase}>
        <path d="M12 3l1.8 5 5 1.8-5 1.8L12 17l-1.8-5.4-5-1.8 5-1.8z" />
        <path d="M19 16l.8 2.2 2.2.8-2.2.8L19 22l-.8-2.2-2.2-.8 2.2-.8z" />
      </svg>
    ),
  },
];

interface ModeSelectorProps {
  value: Mode;
  onChange: (mode: Mode) => void;
  disabled?: boolean;
  remaining?: number;
}

export default function ModeSelector({ value, onChange, disabled, remaining }: ModeSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        const insufficient = remaining !== undefined && opt.cost > remaining;
        const blocked = disabled || insufficient;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => !blocked && onChange(opt.value)}
            disabled={blocked}
            className={`group relative flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all ${
              selected && !blocked
                ? 'border-accent-300 bg-gradient-to-br from-accent-50 to-white shadow-[0_8px_22px_-12px_rgba(244,63,94,0.35)]'
                : blocked
                  ? 'opacity-40 cursor-not-allowed border-accent-100/60 bg-white'
                  : 'border-accent-100/60 bg-white hover:border-accent-200 hover:shadow-[0_8px_22px_-14px_rgba(244,63,94,0.25)] cursor-pointer'
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                selected && !blocked
                  ? 'bg-accent-400 text-white'
                  : 'bg-accent-50 text-accent-500 group-hover:bg-accent-100'
              }`}
            >
              {opt.icon}
            </span>

            <div className="min-w-0">
              <p className={`text-sm font-semibold tracking-tight ${selected ? 'text-gray-900' : 'text-gray-800'}`}>
                {opt.title}
              </p>
              <p className="text-[11px] text-gray-400 leading-snug mt-0.5">
                {opt.description}
              </p>
            </div>

            <span
              className={`text-[10px] font-semibold tracking-wide ${
                selected ? 'text-accent-500' : 'text-gray-400'
              }`}
            >
              {opt.cost} use{opt.cost > 1 ? 's' : ''}
            </span>

            {insufficient && (
              <span className="text-[10px] text-accent-500 font-medium">Not enough uses</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
