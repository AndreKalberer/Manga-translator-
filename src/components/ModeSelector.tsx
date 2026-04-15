import type { Mode } from '@/types';

interface ModeOption {
  value: Mode;
  icon: string;
  title: string;
  description: string;
  cost: 1 | 2;
}

const OPTIONS: ModeOption[] = [
  {
    value: 'translate',
    icon: '💬',
    title: 'Translate',
    description: 'English text in speech bubbles',
    cost: 1,
  },
  {
    value: 'color',
    icon: '🎨',
    title: 'Colorize',
    description: 'Add vibrant color to B&W panels',
    cost: 1,
  },
  {
    value: 'both',
    icon: '✨',
    title: 'Both',
    description: 'Translate and colorize together',
    cost: 2,
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
    <div className="grid grid-cols-3 gap-2">
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
            className={`relative flex flex-col items-start gap-1.5 rounded-xl border-2 p-3 text-left transition-all ${
              selected && !blocked
                ? 'border-accent-500 bg-accent-50'
                : blocked
                  ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
            }`}
          >
            <span className="text-xl leading-none">{opt.icon}</span>
            <span className={`text-sm font-semibold ${selected ? 'text-accent-700' : 'text-gray-800'}`}>
              {opt.title}
            </span>
            <span className="text-xs text-gray-400 leading-snug">{opt.description}</span>

            {/* Cost badge */}
            <span
              className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                opt.cost === 2
                  ? selected
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-amber-50 text-amber-600'
                  : selected
                    ? 'bg-accent-100 text-accent-700'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              {opt.cost} use{opt.cost > 1 ? 's' : ''}
            </span>

            {insufficient && (
              <span className="text-[10px] text-red-400 font-medium">Not enough uses</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
