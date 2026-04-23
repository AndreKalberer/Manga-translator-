import { createHash } from 'crypto';

type SecurityEvent =
  | { event: 'quota.burst_blocked' }
  | { event: 'quota.daily_blocked'; used: number; limit: number; cost: number }
  | { event: 'translate.invalid_origin'; origin: string }
  | { event: 'translate.invalid_mode'; mode: string }
  | { event: 'translate.invalid_type'; mime: string }
  | { event: 'translate.size_exceeded'; bytes: number }
  | { event: 'translate.invalid_image_magic' }
  | { event: 'translate.missing_ip' }
  | { event: 'debug.unauthorized' };

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/**
 * Emit a structured JSON log line for an abuse-relevant event. The IP is
 * one-way hashed (truncated SHA-256) so logs can correlate repeat offenders
 * across requests without storing the raw address. Vercel's log drains pick
 * these up automatically.
 */
export function logSecurityEvent(ip: string | null, e: SecurityEvent): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      ip: ip ? hashIp(ip) : 'none',
      ...e,
    })
  );
}
