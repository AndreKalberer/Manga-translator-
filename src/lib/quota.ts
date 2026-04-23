// ---------------------------------------------------------------------------
// Daily quota system — signed HttpOnly cookie (persists across reloads)
// ---------------------------------------------------------------------------
//
// State lives in an HMAC-signed cookie so it survives serverless cold starts
// that wipe in-memory Maps. Bypassable via incognito / clearing cookies —
// acceptable for a free-tier app; upgrade to Vercel KV if stronger
// enforcement is needed.
//
// Per-minute burst limiting stays in memory (best-effort, per-instance) since
// it only needs to hold for ~60s and doesn't need cross-invocation persistence.

import crypto from 'crypto';

export const DAILY_LIMIT = 10;
export const QUOTA_COOKIE_NAME = 'mtq';

const BURST_MAX = 10;
const BURST_WINDOW_MS = 60 * 1000;

interface BurstEntry {
  count: number;
  windowStart: number;
}
const burstMap = new Map<string, BurstEntry>();

interface QuotaState {
  dayKey: string; // "YYYY-MM-DD" UTC
  used: number;
}

function getDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getResetAt(): string {
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  return tomorrow.toISOString();
}

function getSecret(): string {
  const s = process.env.QUOTA_SECRET;
  if (!s || s.length < 16) {
    throw new Error('QUOTA_SECRET must be set to a random string of at least 16 characters');
  }
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

function encodeState(state: QuotaState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decodeState(cookieValue: string | undefined): QuotaState | null {
  if (!cookieValue) return null;
  const dot = cookieValue.indexOf('.');
  if (dot < 1) return null;
  const payload = cookieValue.slice(0, dot);
  const hmac = cookieValue.slice(dot + 1);
  const expected = sign(payload);
  if (expected.length !== hmac.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hmac, 'hex'))) return null;
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as QuotaState;
    if (typeof parsed.used !== 'number' || typeof parsed.dayKey !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function loadState(cookieValue: string | undefined): QuotaState {
  const today = getDayKey();
  const decoded = decodeState(cookieValue);
  if (!decoded || decoded.dayKey !== today) {
    return { dayKey: today, used: 0 };
  }
  return decoded;
}

export interface ConsumeResult {
  allowed: boolean;
  reason?: 'burst' | 'daily';
  remaining: number;
  resetAt: string;
  /** If set, caller MUST include this as a `Set-Cookie` header on the response. */
  setCookie?: string;
}

export function checkAndConsume(
  ip: string,
  cookieValue: string | undefined,
  cost: 1 | 2 = 1
): ConsumeResult {
  const now = Date.now();

  // Burst — per-instance, best-effort
  const existing = burstMap.get(ip);
  const window =
    !existing || now - existing.windowStart > BURST_WINDOW_MS
      ? { count: 0, windowStart: now }
      : existing;
  burstMap.set(ip, window);

  const state = loadState(cookieValue);

  if (window.count >= BURST_MAX) {
    return {
      allowed: false,
      reason: 'burst',
      remaining: Math.max(0, DAILY_LIMIT - state.used),
      resetAt: getResetAt(),
    };
  }

  if (state.used + cost > DAILY_LIMIT) {
    return {
      allowed: false,
      reason: 'daily',
      remaining: Math.max(0, DAILY_LIMIT - state.used),
      resetAt: getResetAt(),
    };
  }

  state.used += cost;
  window.count += 1;

  return {
    allowed: true,
    remaining: DAILY_LIMIT - state.used,
    resetAt: getResetAt(),
    setCookie: buildCookieHeader(encodeState(state)),
  };
}

export function peekQuota(cookieValue: string | undefined): {
  remaining: number;
  limit: number;
  resetAt: string;
} {
  const state = loadState(cookieValue);
  return {
    remaining: Math.max(0, DAILY_LIMIT - state.used),
    limit: DAILY_LIMIT,
    resetAt: getResetAt(),
  };
}

/** Build a `Set-Cookie` header value that expires at the next UTC midnight. */
export function buildCookieHeader(value: string): string {
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  const maxAge = Math.floor((tomorrow.getTime() - Date.now()) / 1000);
  return `${QUOTA_COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
