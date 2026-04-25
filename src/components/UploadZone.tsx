'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { formatFileSize } from '@/lib/utils';
import ModeSelector from './ModeSelector';
import TranslationOptionsPanel from './TranslationOptions';
import type { Mode, TranslationOptions } from '@/types';

interface UploadZoneProps {
  onSubmit: (files: File[]) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  options: TranslationOptions;
  onOptionsChange: (next: Partial<TranslationOptions>) => void;
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
  options,
  onOptionsChange,
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

  const costForMode: 1 | 2 = mode === 'both' ? 2 : 1;
  const insufficientForMode = remaining !== undefined && remaining < costForMode;
  const isBlocked = disabled || quotaExhausted || insufficientForMode;

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

  // Paste-from-clipboard: Cmd/Ctrl+V anywhere on the page grabs any image
  // files from the clipboard and adds them. Massive UX win for the
  // screenshot-then-translate flow.
  useEffect(() => {
    if (disabled) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const files = items
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length > 0) {
        e.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addFiles, disabled]);

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

      {/* Translation options — hidden for color-only mode (no translation happens) */}
      {mode !== 'color' && (
        <TranslationOptionsPanel
          options={options}
          onChange={onOptionsChange}
          disabled={disabled}
        />
      )}

      {/* Drop zone */}
      <div
        onClick={() => !isBlocked && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!isBlocked) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl p-10 text-center transition-all border bg-gradient-to-br ${
          isBlocked
            ? 'opacity-60 cursor-not-allowed border-accent-100/60 from-white to-accent-50/40'
            : dragging
              ? 'cursor-copy border-accent-200 from-accent-50 to-accent-100/60 ring-2 ring-accent-300/70 shadow-[0_20px_50px_-20px_rgba(244,63,94,0.35)]'
              : 'cursor-pointer border-accent-100/60 from-white to-accent-50/40 shadow-[0_10px_30px_-15px_rgba(244,63,94,0.15)] hover:shadow-[0_16px_40px_-15px_rgba(244,63,94,0.28)] hover:border-accent-200'
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

        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-white border border-accent-100 text-accent-500 flex items-center justify-center shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="text-gray-900 font-semibold text-sm">
          {quotaExhausted ? 'Daily limit reached' : 'Drop your manga panels here'}
        </p>
        <p className="text-gray-400 text-xs mt-1">
          {quotaExhausted
            ? 'Come back tomorrow for more free uses'
            : 'or click to browse · paste with ⌘V · JPEG, PNG, WebP · max 4 MB'}
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
        <>
          <button
            onClick={handleSubmit}
            disabled={isBlocked}
            className="w-full py-3 px-6 rounded-xl font-semibold bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white text-sm"
          >
            {MODE_LABELS[mode]} {selectedFiles.length} {selectedFiles.length === 1 ? 'panel' : 'panels'}
          </button>
          {insufficientForMode && !quotaExhausted && (
            <p className="text-xs text-accent-500 text-center -mt-1">
              &ldquo;{MODE_LABELS[mode]}&rdquo; costs {costForMode} uses, but you only have {remaining} left today. Switch to a 1-use mode or wait until tomorrow.
            </p>
          )}
        </>
      )}
    </div>
  );
}
