import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About — MangaTranslate',
};

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      <h1 className="text-3xl font-bold">About MangaTranslate</h1>

      <section className="space-y-3 text-gray-300 leading-relaxed">
        <h2 className="text-xl font-semibold text-white">What is this?</h2>
        <p>
          MangaTranslate uses state-of-the-art AI image models to translate speech bubbles and
          text found in manga (Japanese), manhwa (Korean), and manhua (Chinese) panels directly
          into English.
        </p>
        <p>
          Simply upload your image files and the AI will detect the source language, translate the
          dialogue naturally, and return three variations for you to pick the best result.
        </p>
      </section>

      <section className="space-y-3 text-gray-300 leading-relaxed">
        <h2 className="text-xl font-semibold text-white">How does it work?</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-400">
          <li>You upload one or more panel images (JPEG, PNG, or WebP, up to 20 MB each).</li>
          <li>
            Each image is sent to an AI image model that reads the text, translates it, and
            redraws the panel with English text in the speech bubbles.
          </li>
          <li>Three translation variations are generated so you can choose the best one.</li>
          <li>Download your favourite variation directly from the browser — no account needed.</li>
        </ol>
      </section>

      <section className="space-y-3 text-gray-300 leading-relaxed">
        <h2 className="text-xl font-semibold text-white">Privacy</h2>
        <p>
          Uploaded images are processed in memory and are never stored on our servers. They are
          sent to the OpenAI API for translation and discarded immediately after. See our{' '}
          <a href="/privacy" className="text-brand-400 hover:underline">
            Privacy Policy
          </a>{' '}
          for details.
        </p>
      </section>

      <section className="space-y-3 text-gray-300 leading-relaxed">
        <h2 className="text-xl font-semibold text-white">Limitations</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li>Output images may be resized by the AI model.</li>
          <li>Handwritten or stylised text may not always be detected correctly.</li>
          <li>Sound effects (onomatopoeia) are translated as best-effort approximations.</li>
          <li>Results depend on the quality and clarity of the uploaded panel.</li>
        </ul>
      </section>
    </div>
  );
}
