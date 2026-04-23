import { createHash } from 'crypto';

type SecurityEvent =
  | { event: 'quota.burst_blocked' }
  | { event: 'quota.daily_blocked'; used: number; limit: number }
  | { event: 'translate.invalid_type'; mime: string }
  | { event: 'translate.size_exceeded'; bytes: number }
  | { event: 'debug.unauthorized' };

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

export function logSecurityEvent(ip: string, e: SecurityEvent): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ip: hashIp(ip), ...e }));
}
