'use client';

import { useState } from 'react';
import {
  Language,
  LANGUAGE_NATIVE,
  TranslationStyle,
  SfxMode,
  TranslationOptions,
} from '@/types';

interface TranslationOptionsPanelProps {
  options: TranslationOptions;
  onChange: (next: Partial<TranslationOptions>) => void;
  disabled?: boolean;
}

const STYLE_OPTIONS: { value: TranslationStyle; label: string; hint: string }[] = [
  { value: 'official', label: 'Official', hint: 'Viz / Yen Press style' },
  { value: 'literal', label: 'Literal', hint: 'Keeps honorifics, closer to source' },
  { value: 'casual', label: 'Casual', hint: 'Modern slang, contractions' },
];

const SFX_OPTIONS: { value: SfxMode; label: string; hint: string }[] = [
  { value: 'translate', label: 'Translate', hint: 'WHOOSH, BANG, SIGH' },
  { value: 'keep', label: 'Keep', hint: 'Original SFX preserved' },
  { value: 'bilingual', label: 'Both', hint: 'Original + translation' },
];

export default function TranslationOptionsPanel({
  options,
  onChange,
  disabled,
}: TranslationOptionsPanelProps) {
  const [glossaryOpen, setGlossaryOpen] = useState(
    Boolean(options.glossary && options.glossary.trim().length > 0)
  );

  return (
    <div className="bg-white border border-accent-100/60 rounded-2xl p-4 space-y-4 shadow-[0_8px_24px_-15px_rgba(244,63,94,0.18)]">
      {/* Target language */}
      <div className="grid grid-cols-[7rem_1fr] items-center gap-3">
        <label htmlFor="target-lang" className="text-xs font-bold tracking-wider uppercase text-gray-500">
          Language
        </label>
        <select
          id="target-lang"
          value={options.targetLang}
          onChange={(e) => onChange({ targetLang: e.target.value as Language })}
          disabled={disabled}
          className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {(Object.keys(LANGUAGE_NATIVE) as Language[]).map((code) => (
            <option key={code} value={code}>
              {LANGUAGE_NATIVE[code]}
            </option>
          ))}
        </select>
      </div>

      {/* Style preset */}
      <div className="grid grid-cols-[7rem_1fr] items-start gap-3">
        <span className="text-xs font-bold tracking-wider uppercase text-gray-500 pt-2">
          Style
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {STYLE_OPTIONS.map((opt) => {
            const active = options.style === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => !disabled && onChange({ style: opt.value })}
                disabled={disabled}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                  active
                    ? 'border-accent-300 bg-accent-50 text-gray-900'
                    : 'border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={opt.hint}
              >
                <span className="block text-xs font-semibold">{opt.label}</span>
                <span className="block text-[10px] text-gray-400 leading-tight mt-0.5 truncate">
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SFX handling */}
      <div className="grid grid-cols-[7rem_1fr] items-start gap-3">
        <span className="text-xs font-bold tracking-wider uppercase text-gray-500 pt-2">
          SFX
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {SFX_OPTIONS.map((opt) => {
            const active = options.sfx === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => !disabled && onChange({ sfx: opt.value })}
                disabled={disabled}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                  active
                    ? 'border-accent-300 bg-accent-50 text-gray-900'
                    : 'border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={opt.hint}
              >
                <span className="block text-xs font-semibold">{opt.label}</span>
                <span className="block text-[10px] text-gray-400 leading-tight mt-0.5 truncate">
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Glossary (collapsible) */}
      <div>
        <button
          type="button"
          onClick={() => setGlossaryOpen((v) => !v)}
          disabled={disabled}
          className="flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-3 h-3 transition-transform ${glossaryOpen ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          Glossary
          {options.glossary && options.glossary.trim().length > 0 && !glossaryOpen && (
            <span className="text-accent-500 lowercase font-medium normal-case">
              ({options.glossary.split('\n').filter((l) => l.trim()).length} pinned)
            </span>
          )}
        </button>
        {glossaryOpen && (
          <div className="mt-2">
            <textarea
              value={options.glossary ?? ''}
              onChange={(e) => onChange({ glossary: e.target.value })}
              disabled={disabled}
              placeholder={`Pin character names or terms (one per line):\n主人公 = Luffy\nお兄ちゃん = Bro`}
              rows={4}
              className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-xs font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-300 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Format: <code className="bg-gray-100 rounded px-1">original = translation</code>, one per line. Applied verbatim.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
