'use client';

import { useState } from 'react';
import { ProcessedImage } from '@/types';

interface ImageResultCardProps {
  result: ProcessedImage;
}

export default function ImageResultCard({ result }: ImageResultCardProps) {
  const [selected, setSelected] = useState(0);

  const selectedVariation = result.variations[selected];

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = selectedVariation.dataUrl;
    const base = result.originalFileName
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9._\- ]/g, '_')
      .slice(0, 100);
    link.download = `${base}_translated_v${selected + 1}.png`;
    link.click();
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-700 font-medium truncate">{result.originalFileName}</p>
        <button
          onClick={handleDownload}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold transition-colors"
        >
          Download
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Original */}
        <div>
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest mb-2">
            Original
          </p>
          <img
            src={result.originalDataUrl}
            alt="Original manga panel"
            className="w-full rounded-xl object-contain max-h-64 bg-gray-50"
          />
        </div>

        {/* Variation picker */}
        <div>
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest mb-2">
            Pick the best translation
          </p>
          <div className="grid grid-cols-3 gap-2">
            {result.variations.map((v) => (
              <button
                key={v.index}
                onClick={() => setSelected(v.index)}
                className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                  selected === v.index
                    ? 'border-accent-500 shadow-sm'
                    : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                <img
                  src={v.dataUrl}
                  alt={`Translation option ${v.index + 1}`}
                  className="w-full object-cover aspect-square"
                />
                <span
                  className={`absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    selected === v.index
                      ? 'bg-accent-600 text-white'
                      : 'bg-white/90 text-gray-500'
                  }`}
                >
                  {v.index + 1}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected preview */}
        <div>
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest mb-2">
            Option {selected + 1} — selected
          </p>
          <img
            src={selectedVariation.dataUrl}
            alt={`Selected translation option ${selected + 1}`}
            className="w-full rounded-xl object-contain bg-gray-50"
          />
        </div>
      </div>
    </div>
  );
}
