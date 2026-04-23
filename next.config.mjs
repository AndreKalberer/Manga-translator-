/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15: renamed from serverComponentsExternalPackages
  serverExternalPackages: ['sharp'],
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        // Prevent the page from being embedded in iframes (clickjacking)
        { key: 'X-Frame-Options', value: 'DENY' },
        // Prevent MIME-type sniffing
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        // Strict referrer policy — don't leak the URL to third parties
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // Disable browser features we don't use
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        // Content-Security-Policy is set per-request by src/middleware.ts so a
        // fresh nonce can be embedded in script-src, removing the need for 'unsafe-inline'.
      ],
    },
    {
      // HSTS — tell browsers to always use HTTPS (only effective over HTTPS)
      source: '/(.*)',
      headers: [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ],
    },
  ],
};

export default nextConfig;
