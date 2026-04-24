import type { Metadata } from 'next';
import Script from 'next/script';
import { headers } from 'next/headers';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  title: 'MangaTL — Translate Manga Panels to English',
  description:
    'Upload manga, manhwa, or manhua panels and get instant AI-powered English translations. Japanese, Korean, and Chinese supported.',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: 'website',
    siteName: 'MangaTL',
    title: 'MangaTL — Translate Manga Panels to English',
    description:
      'AI-powered translator for manga, manhwa, and manhua panels. Upload, translate, and re-letter bubbles in seconds.',
    url: SITE_URL,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MangaTL — AI manga panel translator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MangaTL — Translate Manga Panels to English',
    description:
      'AI-powered translator for manga, manhwa, and manhua panels. Upload, translate, and re-letter bubbles in seconds.',
    images: ['/og-image.png'],
  },
};

// FAQ copy duplicated here so Google sees FAQPage structured data at page
// load. Keep in sync with the FAQ array in src/app/page.tsx.
const FAQ_ENTRIES: Array<{ q: string; a: string }> = [
  {
    q: 'What counts as one "use"?',
    a: 'Each panel you upload counts as one use. "Translate + Colorize" mode costs two uses because it runs both a translation pass and a colorization pass.',
  },
  {
    q: 'Does it work on webtoons and manhwa?',
    a: 'Yes. The model handles Japanese manga, Korean manhwa, and Chinese manhua automatically — no language setting needed.',
  },
  {
    q: 'Why do I only get 10 free uses per day?',
    a: 'Each panel costs real money to process via the AI models. A daily limit keeps the service free for everyone. The count resets at UTC midnight.',
  },
  {
    q: 'Are my images stored anywhere?',
    a: 'No. Panels are processed in memory and sent to OpenAI for translation and rendering. We do not save, log, or share your images.',
  },
  {
    q: 'Can I upload a screenshot with browser or reader UI around the panel?',
    a: 'Yes. The model crops to the panel and ignores browser chrome, status bars, and reader-app UI automatically.',
  },
  {
    q: 'Can I translate multiple panels at once?',
    a: 'Yes — drop up to 10 panels in at a time. They process one after another with a progress bar for each.',
  },
];

// Schema.org structured data. SoftwareApplication identifies the site as a
// web app (rich results); FAQPage lets Google render the FAQ answers
// directly in search previews.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'MangaTL',
      description:
        'AI-powered translator for manga, manhwa, and manhua panels. Upload a panel, get a publication-quality English translation rendered into the original bubbles.',
      url: SITE_URL,
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'Any (web)',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      inLanguage: 'en',
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ_ENTRIES.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const rawAdsenseId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? '';
  const adsenseId = /^ca-pub-\d{16}$/.test(rawAdsenseId) ? rawAdsenseId : null;

  // CSP nonce set by middleware.ts. We forward it to every <Script> so they
  // pass the strict script-src CSP that drops 'unsafe-inline'.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
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
        <Analytics />
        <SpeedInsights />
        <footer className="mt-auto border-t border-gray-100 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
            <p>
              &copy; {new Date().getFullYear()} MangaTL &mdash; images are never stored
            </p>
            <div className="flex items-center gap-4">
              <span className="text-gray-300">Powered by OpenAI</span>
              <a href="/about" className="hover:text-gray-600 transition-colors">About</a>
              <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-gray-600 transition-colors">Terms</a>
              <a href="mailto:hello@mangatl.com" className="hover:text-gray-600 transition-colors">Contact</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
