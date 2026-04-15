import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'MangaTranslate — Translate Manga Panels to English',
  description:
    'Upload manga, manhwa, or manhua panels and get instant AI-powered English translations. Powered by the latest image AI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Validate the AdSense ID format before injecting it into a script URL.
  // A publisher ID is always "ca-pub-" followed by exactly 16 digits.
  const rawAdsenseId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? '';
  const adsenseId = /^ca-pub-\d{16}$/.test(rawAdsenseId) ? rawAdsenseId : null;

  return (
    <html lang="en">
      <head />
      <body className="bg-gray-950 text-white min-h-screen antialiased">
        {adsenseId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
        <footer className="border-t border-gray-800 mt-16">
          <div className="max-w-5xl mx-auto px-4 py-6 text-center text-xs text-gray-600">
            <p>
              MangaTranslate &copy; {new Date().getFullYear()} &middot;{' '}
              <a href="/privacy" className="hover:text-gray-400 transition-colors">
                Privacy Policy
              </a>{' '}
              &middot;{' '}
              <a href="/about" className="hover:text-gray-400 transition-colors">
                About
              </a>
            </p>
            <p className="mt-1">
              Images are processed in memory and never stored. Translation quality depends on the
              AI model.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
