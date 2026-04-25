// ---------------------------------------------------------------------------
// Session character memory
// ---------------------------------------------------------------------------
//
// Maintains a per-tab list of characters seen so far across this session,
// auto-extracted from translated panels and fed back into subsequent
// translator calls so a recurring character keeps a consistent voice across
// pages. Persists in sessionStorage (cleared on tab close) — long-term
// memory across sessions would risk stale character contexts polluting
// unrelated panels.

import type { PanelAnalysis } from '@/types';

export interface Character {
  id: string;
  description: string;
  voiceNotes: string;
  count: number;
  lastSeen: number;
}

const STORAGE_KEY = 'mtl.characters';
const MAX_CHARACTERS = 20;
const MAX_DESC_LEN = 200;
const MAX_NOTES_LEN = 200;

function dedupKey(description: string): string {
  return description.trim().toLowerCase();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

export function loadCharacters(): Character[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (c): c is Character =>
          c &&
          typeof c.id === 'string' &&
          typeof c.description === 'string' &&
          typeof c.voiceNotes === 'string' &&
          typeof c.count === 'number' &&
          typeof c.lastSeen === 'number'
      )
      .slice(0, MAX_CHARACTERS);
  } catch {
    return [];
  }
}

export function saveCharacters(chars: Character[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chars));
  } catch { /* storage blocked or full — best effort */ }
}

/**
 * Merge new bubbles from a translated analysis into the existing character
 * list. Dedupes by case-insensitive description match. Caps the result at
 * MAX_CHARACTERS using LRU eviction (oldest lastSeen drops first).
 *
 * SFX / narration / signs (which have no speaker) are ignored. Empty
 * descriptions are ignored.
 */
export function mergeFromAnalysis(
  existing: Character[],
  analysis: PanelAnalysis
): Character[] {
  const now = Date.now();
  const map = new Map<string, Character>();
  for (const c of existing) map.set(dedupKey(c.description), c);

  for (const bubble of analysis.bubbles) {
    const desc = bubble.speakerDescription?.trim();
    if (!desc) continue;
    if (bubble.kind === 'sfx' || bubble.kind === 'narration' || bubble.kind === 'sign') continue;
    const key = dedupKey(desc);
    const prior = map.get(key);
    if (prior) {
      prior.count += 1;
      prior.lastSeen = now;
      // Prefer the most recent voiceNotes when present (the latest panel is
      // the most current read on that character's tone).
      if (bubble.voiceNotes?.trim()) {
        prior.voiceNotes = truncate(bubble.voiceNotes.trim(), MAX_NOTES_LEN);
      }
    } else {
      map.set(key, {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${now}-${Math.random().toString(36).slice(2)}`,
        description: truncate(desc, MAX_DESC_LEN),
        voiceNotes: truncate(bubble.voiceNotes?.trim() ?? '', MAX_NOTES_LEN),
        count: 1,
        lastSeen: now,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, MAX_CHARACTERS);
}

/**
 * Format the character list as a system-prompt block. Returns an empty string
 * when no characters are tracked, so the caller can drop it directly into a
 * template without conditional rendering.
 */
export function serializeForPrompt(chars: Character[]): string {
  if (chars.length === 0) return '';
  const lines = chars.map((c, i) => {
    const seen = c.count > 1 ? ` (seen ${c.count} times)` : '';
    const voice = c.voiceNotes ? ` — voice: ${c.voiceNotes}` : '';
    return `${i + 1}. "${c.description}"${voice}${seen}`;
  });
  return `# Session character memory (soft suggestions)
Earlier in this session you've already translated panels containing these characters:

${lines.join('\n')}

When a character in this new panel visually matches any of these descriptions, maintain their established voice and tone. Treat these as soft suggestions for consistency, NOT hard rules — if a character clearly differs from prior appearances, write them differently. Do not invent characters that aren't visually present in the current panel just because they appeared earlier.`;
}
