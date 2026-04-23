// ---------------------------------------------------------------------------
// Daily quota system (in-memory, resets at midnight UTC)
// ---------------------------------------------------------------------------

export const DAILY_LIMIT = 10;

// Per-minute burst guard
const BURST_MAX = 10;
const BURST_WINDOW_MS = 60 * 1000;

interface QuotaEntry {
  dayKey: string; // "YYYY-MM-DD" UTC
  used: number;
  burstCount: number;
  burstWindowStart: number;
}

const quotaMap = new Map<string, QuotaEntry>();

// Prune entries from previous days to prevent unbounded memory growth
const CLEANUP_INTERVAL = 100;
let requestsSinceCleanup = 0;

function maybePruneStaleEntries(): void {
  if (++requestsSinceCleanup < CLEANUP_INTERVAL) return;
  requestsSinceCleanup = 0;
  const today = getDayKey();
  for (const [ip, entry] of quotaMap) {
    if (entry.dayKey !== today) quotaMap.delete(ip);
  }
}

function getDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getResetAt(): string {
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  return tomorrow.toISOString();
}

/** Consume `cost` quota units. Returns whether the request is allowed and the updated state. */
export function checkAndConsume(
  ip: string,
  cost: 1 | 2 = 1
): {
  allowed: boolean;
  reason?: 'burst' | 'daily';
  remaining: number;
  resetAt: string;
} {
  const today = getDayKey();
  const now = Date.now();
  const entry = quotaMap.get(ip);

  if (!entry || entry.dayKey !== today) {
    quotaMap.set(ip, { dayKey: today, used: cost, burstCount: 1, burstWindowStart: now });
    return { allowed: true, remaining: DAILY_LIMIT - cost, resetAt: getResetAt() };
  }

  // Burst check
  if (now - entry.burstWindowStart > BURST_WINDOW_MS) {
    entry.burstCount = 0;
    entry.burstWindowStart = now;
  }
  if (entry.burstCount >= BURST_MAX) {
    return {
      allowed: false,
      reason: 'burst',
      remaining: Math.max(0, DAILY_LIMIT - entry.used),
      resetAt: getResetAt(),
    };
  }

  // Daily check — ensure there are enough uses left for the cost
  if (entry.used + cost > DAILY_LIMIT) {
    return { allowed: false, reason: 'daily', remaining: Math.max(0, DAILY_LIMIT - entry.used), resetAt: getResetAt() };
  }

  entry.used += cost;
  entry.burstCount += 1;
  maybePruneStaleEntries();
  return { allowed: true, remaining: DAILY_LIMIT - entry.used, resetAt: getResetAt() };
}

/** Enforce burst limit only — no daily quota consumed. Used for cheap read-only endpoints. */
export function checkBurstOnly(ip: string): boolean {
  const today = getDayKey();
  const now = Date.now();
  const entry = quotaMap.get(ip);

  if (!entry || entry.dayKey !== today) {
    quotaMap.set(ip, { dayKey: today, used: 0, burstCount: 1, burstWindowStart: now });
    return true;
  }

  if (now - entry.burstWindowStart > BURST_WINDOW_MS) {
    entry.burstCount = 0;
    entry.burstWindowStart = now;
  }

  if (entry.burstCount >= BURST_MAX) return false;
  entry.burstCount += 1;
  return true;
}

/** Read quota without consuming it (for GET /api/quota). */
export function peekQuota(ip: string): { remaining: number; limit: number; resetAt: string } {
  const today = getDayKey();
  const entry = quotaMap.get(ip);
  if (!entry || entry.dayKey !== today) {
    return { remaining: DAILY_LIMIT, limit: DAILY_LIMIT, resetAt: getResetAt() };
  }
  return {
    remaining: Math.max(0, DAILY_LIMIT - entry.used),
    limit: DAILY_LIMIT,
    resetAt: getResetAt(),
  };
}
