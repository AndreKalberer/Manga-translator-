import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — MangaTranslate',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-gray-400 text-sm">Last updated: April 2026</p>

      <section className="space-y-3 text-gray-300 leading-relaxed">
        <h2 className="text-xl font-semibold text-white">Data we collect</h2>
        <p>
          MangaTranslate does not require registration and does not collect personal information.
        </p>
        <p>
          When you upload an image, it is sent securely to the OpenAI API for processing and is
          not stored on our servers. We do not retain copies of your images or the translated
          results.
        </p>
      </section>

      <section className="space-y-3 text-gray-300 leading-relaxed">
        <h2 className="text-xl font-semibold text-white">Third-party services</h2>
        <p>
          <strong className="text-white">OpenAI API:</strong> Image data is sent to OpenAI for
          translation. OpenAI&apos;s data usage policies apply. See{' '}
          <a
            href="https://openai.com/policies/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-400 hover:underline"
          >
            OpenAI&apos;s Privacy Policy
          </a>
          .
        </p>
        <p>
          <strong className="text-white">Google AdSense:</strong> This site displays advertisements
          served by Google AdSense. Google may use cookies to serve ads based on your prior visits
          to this or other websites. You can opt out of personalised advertising by visiting{' '}
          <a
            href="https://www.google.com/settings/ads"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-400 hover:underline"
          >
            Google&apos;s Ads Settings
          </a>
          .
        </p>
      </section>

      <section className="space-y-3 text-gray-300 leading-relaxed">
        <h2 className="text-xl font-semibold text-white">Cookies</h2>
        <p>
          We do not set our own cookies. Google AdSense may set cookies to serve relevant
          advertisements. You can control cookie preferences through your browser settings.
        </p>
      </section>

      <section className="space-y-3 text-gray-300 leading-relaxed">
        <h2 className="text-xl font-semibold text-white">Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Changes will be posted on this page with an
          updated date.
        </p>
      </section>
    </div>
  );
}
