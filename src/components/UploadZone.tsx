'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { formatFileSize } from '@/lib/utils';

interface UploadZoneProps {
  onSubmit: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILE_COUNT = 10;

export default function UploadZone({ onSubmit, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // Track object URLs so we can revoke them when files are removed or the component unmounts
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    return () => {
      // Revoke all object URLs on unmount to prevent memory leaks
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const valid = Array.from(incoming).filter(
      (f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE
    );
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const toAdd = valid.filter((f) => !existing.has(f.name + f.size));
      const combined = [...prev, ...toAdd].slice(0, MAX_FILE_COUNT);
      // Create object URLs for newly added files only
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
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = () => {
    if (selectedFiles.length > 0) {
      onSubmit(selectedFiles);
      setSelectedFiles([]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-gray-700'
            : dragging
              ? 'border-brand-400 bg-brand-950/20'
              : 'border-gray-600 hover:border-brand-500 hover:bg-gray-800/40'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          disabled={disabled}
        />
        <div className="text-4xl mb-3">📖</div>
        <p className="text-gray-200 font-medium">Drop manga panels here</p>
        <p className="text-gray-500 text-sm mt-1">or click to browse</p>
        <p className="text-gray-600 text-xs mt-3">JPEG, PNG, WebP · max 20 MB per file</p>
      </div>

      {/* Selected file list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={objectUrlsRef.current.get(file.name + file.size) ?? ''}
                  alt=""
                  className="w-10 h-10 object-cover rounded flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="text-gray-500 hover:text-red-400 transition-colors ml-3 flex-shrink-0"
                aria-label="Remove file"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Submit button */}
      {selectedFiles.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={disabled}
          className="w-full py-3 px-6 rounded-xl font-semibold bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
        >
          Translate {selectedFiles.length} {selectedFiles.length === 1 ? 'image' : 'images'}
        </button>
      )}
    </div>
  );
}
