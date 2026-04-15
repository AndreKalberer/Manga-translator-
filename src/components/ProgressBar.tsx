interface ProgressBarProps {
  fileName: string;
  status: 'pending' | 'rendering' | 'done' | 'error';
  errorMessage?: string;
}

const steps: { key: string; label: string }[] = [
  { key: 'pending', label: 'Queued' },
  { key: 'rendering', label: 'Translating' },
  { key: 'done', label: 'Done' },
];

export default function ProgressBar({ fileName, status, errorMessage }: ProgressBarProps) {
  const currentStep = steps.findIndex((s) => s.key === status);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <p className="text-sm text-gray-700 font-medium truncate mb-3">{fileName}</p>

      {status === 'error' ? (
        <p className="text-sm text-red-500">{errorMessage ?? 'An error occurred.'}</p>
      ) : (
        <div className="flex items-center gap-2">
          {steps.map((step, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <div key={step.key} className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                    done || active ? 'bg-accent-600' : 'bg-gray-200'
                  } ${active ? 'ring-2 ring-accent-200' : ''}`}
                />
                <span
                  className={`text-xs ${
                    done || active ? 'text-gray-800 font-medium' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
                {i < steps.length - 1 && (
                  <div
                    className={`h-px w-8 flex-shrink-0 ${done ? 'bg-accent-400' : 'bg-gray-200'}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
