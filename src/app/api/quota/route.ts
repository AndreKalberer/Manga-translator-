import { NextRequest } from 'next/server';
import { peekQuota } from '@/lib/quota';

export async function GET(request: NextRequest) {
  // x-vercel-forwarded-for is set by Vercel's edge and cannot be forged by clients
  const ip =
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const quota = peekQuota(ip);

  return new Response(JSON.stringify(quota), {
    headers: { 'Content-Type': 'application/json' },
  });
}
