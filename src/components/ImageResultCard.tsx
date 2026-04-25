'use client';

import { useEffect, useState } from 'react';
import { ProcessedImage, PanelAnalysis } from '@/types';

interface ImageResultCardProps {
  result: ProcessedImage;
  modeLabel?: string;
  /** Re-render with edited bubble translations. Triggers /api/rerender server-side. */
  onRerender?: (imageId: string, editedAnalysis: PanelAnalysis) => void;
}

export default function ImageResultCard({ result, modeLabel, onRerender }: ImageResultCardProps) {
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);

  // Bubble-edit mode state. `editedTexts` mirrors the analysis bubbles'
  // translatedText fields when in edit mode; on Re-render we splice these
  // back into the analysis and POST to /api/rerender.
  const [editing, setEditing] = useState(false);
  const [editedTexts, setEditedTexts] = useState<string[]>([]);

  const bubbles = result.analysis?.bubbles ?? [];
  const canEdit = !!onRerender && bubbles.length > 0 && result.mode !== 'color';

  // Sync editedTexts with the underlying analysis whenever it changes (e.g.
  // after a successful re-render the server sends back the saved analysis).
  useEffect(() => {
    setEditedTexts(bubbles.map((b) => b.translatedText));
  }, [bubbles]);

  // Defensive guard — variations should never be empty for a 'done' image
  // but a malformed SSE frame or out-of-order error event could leave it so.
  if (!result.variations || result.variations.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center text-sm text-gray-400">
        No image available.
      </div>
    );
  }

  const safeIndex = Math.min(selected, result.variations.length - 1);
  const selectedVariation = result.variations[safeIndex];

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

  const handleCopyTranscript = async () => {
    if (bubbles.length === 0) return;
    const scene = result.analysis?.sceneNotes?.trim();
    const lines = bubbles.map((b, i) => {
      const speaker = b.speakerDescription ? ` (${b.speakerDescription})` : '';
      return `${i + 1}. [${b.kind}]${speaker} ${b.translatedText}`;
    });
    const text = [scene ? `Scene: ${scene}` : null, ...lines].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard denied */ }
  };

  const enterEditMode = () => {
    setEditedTexts(bubbles.map((b) => b.translatedText));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditedTexts(bubbles.map((b) => b.translatedText));
  };

  const dirty =
    editing && editedTexts.some((t, i) => t.trim() !== bubbles[i]?.translatedText);
  const anyEmpty = editing && editedTexts.some((t) => !t.trim());

  const handleRerender = () => {
    if (!onRerender || !result.analysis || !dirty || anyEmpty) return;
    const editedAnalysis: PanelAnalysis = {
      ...result.analysis,
      bubbles: result.analysis.bubbles.map((b, i) => ({
        ...b,
        translatedText: editedTexts[i].trim(),
      })),
    };
    onRerender(result.imageId, editedAnalysis);
    setEditing(false);
  };

  const isRerendering = !!result.rerendering;
  const rerenderError = result.rerenderError;

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm text-gray-700 font-medium truncate">{result.originalFileName}</p>
          {modeLabel && (
            <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">
              {modeLabel}
            </span>
          )}
        </div>
        <button
          onClick={handleDownload}
          disabled={isRerendering}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
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

        {/* Translation (with re-render overlay) */}
        <div className="relative">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest mb-2">
            Translation
          </p>
          <img
            src={selectedVariation.dataUrl}
            alt="Translated panel"
            className={`w-full rounded-xl object-contain bg-gray-50 transition-opacity ${
              isRerendering ? 'opacity-40' : 'opacity-100'
            }`}
          />
          {isRerendering && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
              <div
                className="w-8 h-8 rounded-full border-2 border-accent-200 border-t-accent-500 animate-spin"
                aria-hidden
              />
              <p className="text-xs font-semibold text-accent-600">Re-rendering with your edits…</p>
            </div>
          )}
        </div>

        {rerenderError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <span className="font-semibold">Re-render failed:</span> {rerenderError}
          </div>
        )}

        {/* Transcript (editable) */}
        {result.analysis && bubbles.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest">
                Transcript
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopyTranscript}
                  disabled={isRerendering || editing}
                  className="text-[11px] font-semibold text-accent-600 hover:text-accent-700 transition-colors disabled:opacity-40"
                >
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
                {canEdit && !editing && (
                  <button
                    onClick={enterEditMode}
                    disabled={isRerendering}
                    className="text-[11px] font-semibold text-accent-600 hover:text-accent-700 transition-colors disabled:opacity-40"
                  >
                    Edit
                  </button>
                )}
                {editing && (
                  <button
                    onClick={cancelEdit}
                    className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            {result.analysis.sceneNotes && (
              <p className="text-xs italic text-gray-500 mb-3">{result.analysis.sceneNotes}</p>
            )}
            <ol className="space-y-2.5">
              {bubbles.map((bubble, i) => (
                <li key={i} className="text-sm">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
                      {bubble.kind}
                    </span>
                    {bubble.speakerDescription && (
                      <span className="text-[11px] text-gray-400 truncate">
                        {bubble.speakerDescription}
                      </span>
                    )}
                  </div>
                  {editing ? (
                    <textarea
                      value={editedTexts[i] ?? ''}
                      onChange={(e) =>
                        setEditedTexts((prev) => {
                          const next = [...prev];
                          next[i] = e.target.value;
                          return next;
                        })
                      }
                      rows={Math.max(1, Math.ceil((editedTexts[i]?.length ?? 0) / 60))}
                      className="w-full text-sm text-gray-900 leading-snug bg-accent-50/50 border border-accent-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300 resize-none"
                      placeholder="(empty translations are not allowed)"
                    />
                  ) : (
                    <p className="text-gray-900 leading-snug">{bubble.translatedText}</p>
                  )}
                  {bubble.originalText && bubble.originalText !== bubble.translatedText && (
                    <p className="text-[11px] text-gray-400 mt-0.5">{bubble.originalText}</p>
                  )}
                </li>
              ))}
            </ol>

            {editing && (
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                <p className="text-[11px] text-gray-400">
                  {anyEmpty
                    ? 'Fill every bubble before re-rendering.'
                    : dirty
                      ? 'Re-render costs 1 use.'
                      : 'No changes yet.'}
                </p>
                <button
                  onClick={handleRerender}
                  disabled={!dirty || anyEmpty || isRerendering}
                  className="flex-shrink-0 px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
                >
                  Re-render with edits
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
