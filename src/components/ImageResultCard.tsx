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
    // Strip the extension, then remove any characters that could form path traversal
    // sequences (e.g. "../") before using the name as a download filename.
    const base = result.originalFileName
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9._\- ]/g, '_')
      .slice(0, 100);
    link.download = `${base}_translated_v${selected + 1}.png`;
    link.click();
  };

  return (
    <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <p className="text-sm text-gray-300 font-medium truncate">{result.originalFileName}</p>
        <button
          onClick={handleDownload}
          className="flex-shrink-0 ml-4 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors"
        >
          Download
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Original */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Original</p>
          <img
            src={result.originalDataUrl}
            alt="Original manga panel"
            className="w-full rounded-lg object-contain max-h-64"
          />
        </div>

        {/* Variations picker */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Pick the best translation
          </p>
          <div className="grid grid-cols-3 gap-2">
            {result.variations.map((v) => (
              <button
                key={v.index}
                onClick={() => setSelected(v.index)}
                className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                  selected === v.index
                    ? 'border-brand-400 ring-2 ring-brand-400/30'
                    : 'border-gray-600 hover:border-gray-400'
                }`}
              >
                <img
                  src={v.dataUrl}
                  alt={`Translation option ${v.index + 1}`}
                  className="w-full object-cover aspect-square"
                />
                <span
                  className={`absolute top-1 left-1 text-xs font-bold px-1.5 py-0.5 rounded ${
                    selected === v.index
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-900/80 text-gray-300'
                  }`}
                >
                  {v.index + 1}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected preview (large) */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Selected — option {selected + 1}
          </p>
          <img
            src={selectedVariation.dataUrl}
            alt={`Selected translation option ${selected + 1}`}
            className="w-full rounded-lg object-contain"
          />
        </div>
      </div>
    </div>
  );
}
