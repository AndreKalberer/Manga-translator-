import { NextRequest } from 'next/server';
import { peekQuota } from '@/lib/quota';

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const quota = peekQuota(ip);

  return new Response(JSON.stringify(quota), {
    headers: { 'Content-Type': 'application/json' },
  });
}
