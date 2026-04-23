import type { NextRequest } from 'next/server';

/**
 * Extract the real client IP from a request.
 *
 * Preference order:
 *  1. `x-vercel-forwarded-for` — injected by Vercel's edge layer; cannot
 *                                be spoofed by clients on Vercel.
 *  2. `x-real-ip`              — common reverse-proxy header.
 *  3. `x-forwarded-for` first entry — populated by most load balancers.
 *
 * Returns `null` when no header is present so callers can reject the
 * request rather than lumping all headerless clients into one bucket
 * (which would let an attacker share quota with anonymous good actors).
 */
export function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-vercel-forwarded-for')?.trim() ??
    request.headers.get('x-real-ip')?.trim() ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    null
  );
}
