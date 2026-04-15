interface ProgressBarProps {
  fileName: string;
  status: 'pending' | 'rendering' | 'done' | 'error';
  errorMessage?: string;
}

const steps = [
  { key: 'pending', label: 'Queued' },
  { key: 'rendering', label: 'Translating...' },
  { key: 'done', label: 'Done' },
];

export default function ProgressBar({ fileName, status, errorMessage }: ProgressBarProps) {
  const currentStep = steps.findIndex((s) => s.key === status);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <p className="text-sm text-gray-300 font-medium truncate mb-3">{fileName}</p>

      {status === 'error' ? (
        <p className="text-sm text-red-400">{errorMessage ?? 'An error occurred.'}</p>
      ) : (
        <div className="flex items-center gap-2">
          {steps.map((step, i) => (
            <div key={step.key} className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors ${
                  i < currentStep
                    ? 'bg-brand-400'
                    : i === currentStep
                      ? 'bg-brand-400 animate-pulse'
                      : 'bg-gray-600'
                }`}
              />
              <span
                className={`text-xs ${
                  i <= currentStep ? 'text-gray-200' : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <div
                  className={`h-px w-6 flex-shrink-0 ${i < currentStep ? 'bg-brand-400' : 'bg-gray-600'}`}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
