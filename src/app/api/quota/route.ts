import { NextRequest } from 'next/server';
import { peekQuota, QUOTA_COOKIE_NAME } from '@/lib/quota';

export async function GET(request: NextRequest) {
  const quotaCookie = request.cookies.get(QUOTA_COOKIE_NAME)?.value;
  const quota = peekQuota(quotaCookie);

  return new Response(JSON.stringify(quota), {
    headers: { 'Content-Type': 'application/json' },
  });
}
