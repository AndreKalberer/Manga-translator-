import type { Metadata } from 'next';
import Script from 'next/script';
import { headers } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: 'MangaTL — Translate Manga Panels to English',
  description:
    'Upload manga, manhwa, or manhua panels and get instant AI-powered English translations. Japanese, Korean, and Chinese supported.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const rawAdsenseId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? '';
  const adsenseId = /^ca-pub-\d{16}$/.test(rawAdsenseId) ? rawAdsenseId : null;

  // CSP nonce set by middleware.ts. We forward it to every <Script> so they
  // pass the strict script-src CSP that drops 'unsafe-inline'.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en">
      <head />
      <body className="min-h-screen flex flex-col">
        {adsenseId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
            nonce={nonce}
          />
        )}
        {children}
        <footer className="mt-auto border-t border-gray-100 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
            <p>
              &copy; {new Date().getFullYear()} MangaTL &mdash; images are never stored
            </p>
            <div className="flex items-center gap-4">
              <span className="text-gray-300">Powered by OpenAI</span>
              <a href="/about" className="hover:text-gray-600 transition-colors">About</a>
              <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</a>
              <a href="mailto:hello@mangatl.com" className="hover:text-gray-600 transition-colors">Contact</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
