'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { formatFileSize } from '@/lib/utils';
import ModeSelector from './ModeSelector';
import type { Mode } from '@/types';

interface UploadZoneProps {
  onSubmit: (files: File[]) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  disabled?: boolean;
  quotaExhausted?: boolean;
  remaining?: number;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_FILE_COUNT = 10;

const MODE_LABELS: Record<Mode, string> = {
  translate: 'Translate',
  color: 'Colorize',
  both: 'Translate & Colorize',
};

export default function UploadZone({
  onSubmit,
  mode,
  onModeChange,
  disabled,
  quotaExhausted,
  remaining,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const isBlocked = disabled || quotaExhausted;

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const valid = Array.from(incoming).filter(
      (f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE
    );
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const toAdd = valid.filter((f) => !existing.has(f.name + f.size));
      const combined = [...prev, ...toAdd].slice(0, MAX_FILE_COUNT);
      toAdd.slice(0, MAX_FILE_COUNT - prev.length).forEach((f) => {
        const key = f.name + f.size;
        if (!objectUrlsRef.current.has(key)) {
          objectUrlsRef.current.set(key, URL.createObjectURL(f));
        }
      });
      return combined;
    });
  }, []);

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => {
      const file = prev[index];
      if (file) {
        const key = file.name + file.size;
        const url = objectUrlsRef.current.get(key);
        if (url) {
          URL.revokeObjectURL(url);
          objectUrlsRef.current.delete(key);
        }
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!isBlocked) addFiles(e.dataTransfer.files);
  };

  const handleSubmit = () => {
    if (selectedFiles.length > 0 && !isBlocked) {
      onSubmit(selectedFiles);
      setSelectedFiles([]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <ModeSelector
        value={mode}
        onChange={onModeChange}
        disabled={disabled}
        remaining={remaining}
      />

      {/* Drop zone */}
      <div
        onClick={() => !isBlocked && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!isBlocked) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
          isBlocked
            ? 'opacity-60 cursor-not-allowed border-gray-200 bg-gray-50'
            : dragging
              ? 'border-accent-400 bg-accent-50 cursor-copy'
              : 'border-gray-200 hover:border-accent-300 hover:bg-gray-50 cursor-pointer'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          disabled={isBlocked}
        />

        <div className="text-4xl mb-3 select-none">漫</div>
        <p className="text-gray-900 font-semibold text-sm">
          {quotaExhausted ? 'Daily limit reached' : 'Drop your manga panels here'}
        </p>
        <p className="text-gray-400 text-xs mt-1">
          {quotaExhausted
            ? 'Come back tomorrow for more free uses'
            : 'or click to browse · JPEG, PNG, WebP · max 4 MB'}
        </p>
      </div>

      {/* Selected file list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={objectUrlsRef.current.get(file.name + file.size) ?? ''}
                  alt=""
                  className="w-10 h-10 object-cover rounded-lg flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="text-gray-300 hover:text-red-400 transition-colors ml-3 flex-shrink-0 text-sm"
                aria-label="Remove file"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Submit */}
      {selectedFiles.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={isBlocked}
          className="w-full py-3 px-6 rounded-xl font-semibold bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white text-sm"
        >
          {MODE_LABELS[mode]} {selectedFiles.length} {selectedFiles.length === 1 ? 'panel' : 'panels'}
        </button>
      )}
    </div>
  );
}
