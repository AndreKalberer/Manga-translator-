import { NextRequest, NextResponse } from 'next/server';

// Per-request CSP nonce so we can drop 'unsafe-inline' from script-src.
// The nonce is forwarded to the layout via the x-nonce request header,
// where layout.tsx attaches it to every <Script> tag (Next.js auto-applies
// it to its own runtime scripts when it sees one in the response CSP).
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://pagead2.googlesyndication.com https://www.googletagservices.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://pagead2.googlesyndication.com",
    "connect-src 'self'",
    "font-src 'self'",
    "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  // Skip Next.js internals, static assets, and API routes (CSP only matters
  // for HTML responses; APIs return JSON / SSE where it has no effect).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
