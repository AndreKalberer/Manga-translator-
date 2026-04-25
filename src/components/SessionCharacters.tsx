'use client';

import { useState } from 'react';
import type { Character } from '@/lib/characters';

interface SessionCharactersProps {
  characters: Character[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export default function SessionCharacters({
  characters,
  onRemove,
  onClear,
}: SessionCharactersProps) {
  const [open, setOpen] = useState(false);

  if (characters.length === 0) return null;

  return (
    <div className="bg-white border border-accent-100/60 rounded-2xl shadow-[0_8px_24px_-15px_rgba(244,63,94,0.18)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 text-accent-500 flex-shrink-0"
            aria-hidden
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="text-xs font-bold tracking-wider uppercase text-gray-500">
            Characters this session
          </span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent-50 text-accent-600">
            {characters.length}
          </span>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2.5">
          <p className="text-[11px] text-gray-400">
            Auto-built from your past translations. Used to keep recurring characters&apos; voices
            consistent. Resets when you close the tab.
          </p>
          <ul className="space-y-1.5">
            {characters.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 leading-snug truncate">{c.description}</p>
                  {c.voiceNotes && (
                    <p className="text-[11px] text-gray-500 italic mt-0.5">
                      voice: {c.voiceNotes}
                    </p>
                  )}
                  {c.count > 1 && (
                    <p className="text-[10px] text-accent-500 mt-0.5">seen {c.count} times</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(c.id)}
                  className="flex-shrink-0 w-5 h-5 rounded-full text-gray-300 hover:bg-gray-200 hover:text-gray-600 transition-colors flex items-center justify-center text-[11px]"
                  aria-label={`Remove ${c.description}`}
                  title="Remove from session memory"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] font-semibold text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
