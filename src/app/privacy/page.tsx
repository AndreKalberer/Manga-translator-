import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Privacy Policy — MangaTranslate',
};

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Privacy Policy</h1>
          <p className="text-gray-400 text-sm mt-1">Last updated: April 2026</p>
        </div>

        <section className="space-y-3 text-gray-600 leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">Data we collect</h2>
          <p>
            MangaTranslate does not require registration and does not collect personal information.
          </p>
          <p>
            When you upload an image, it is sent securely to the OpenAI API for processing and is
            not stored on our servers. We do not retain copies of your images or translated results.
          </p>
        </section>

        <section className="space-y-3 text-gray-600 leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">Third-party services</h2>
          <p>
            <strong className="text-gray-900">OpenAI API:</strong> Image data is sent to OpenAI
            for translation. See{' '}
            <a
              href="https://openai.com/policies/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-600 hover:underline"
            >
              OpenAI&apos;s Privacy Policy
            </a>
            .
          </p>
          <p>
            <strong className="text-gray-900">Google AdSense:</strong> This site displays
            advertisements served by Google AdSense. Google may use cookies to serve ads based on
            your prior visits to this or other websites. You can opt out at{' '}
            <a
              href="https://www.google.com/settings/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-600 hover:underline"
            >
              Google&apos;s Ads Settings
            </a>
            .
          </p>
        </section>

        <section className="space-y-3 text-gray-600 leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">Cookies</h2>
          <p>
            We do not set our own cookies. Google AdSense may set cookies to serve relevant
            advertisements. You can control cookie preferences through your browser settings.
          </p>
        </section>

        <section className="space-y-3 text-gray-600 leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">Changes to this policy</h2>
          <p>
            We may update this policy from time to time. Changes will be posted on this page with
            an updated date.
          </p>
        </section>
      </main>
    </div>
  );
}
