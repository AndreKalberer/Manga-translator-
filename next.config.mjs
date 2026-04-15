/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
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
        // Content Security Policy
        // - default-src 'self': only load resources from our own origin by default
        // - script-src allows 'unsafe-inline' (required by Next.js) and Google AdSense
        // - img-src allows data: URIs (our base64 result images) and blob: (object URLs)
        // - connect-src 'self': SSE fetch goes to our own API
        // - style-src allows 'unsafe-inline' (required by Tailwind + Next.js)
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://www.googletagservices.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "connect-src 'self'",
            "font-src 'self'",
            "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
            "frame-ancestors 'none'",
          ].join('; '),
        },
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
