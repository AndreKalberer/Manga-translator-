import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Generate a fresh nonce for every HTML response so we can drop 'unsafe-inline'
  // from script-src. The nonce is forwarded to the layout via the x-nonce request
  // header, where it is attached to every <Script> component.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://pagead2.googlesyndication.com https://www.googletagservices.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://pagead2.googlesyndication.com",
    "connect-src 'self'",
    "font-src 'self'",
    "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
    "frame-ancestors 'none'",
  ].join('; ');

  // Pass nonce to the layout so it can attach it to <Script> tags
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  // Run on all routes except Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
