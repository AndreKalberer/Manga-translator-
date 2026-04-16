import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'About — MangaTranslate',
};

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 space-y-8">
        <h1 className="text-3xl font-black text-gray-900">About MangaTranslate</h1>

        <section className="space-y-3 text-gray-600 leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">What is this?</h2>
          <p>
            MangaTranslate uses AI image models to translate speech bubbles and text found in
            manga (Japanese), manhwa (Korean), and manhua (Chinese) panels directly into English.
          </p>
          <p>
            Upload your panels, and the AI detects the source language, translates the dialogue
            naturally, and returns three variations for you to pick the best result.
          </p>
        </section>

        <section className="space-y-3 text-gray-600 leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">How does it work?</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Upload one or more panel images (JPEG, PNG, or WebP — up to 20 MB each).</li>
            <li>
              Each image is sent to an AI model that reads the text, translates it, and redraws
              the panel with English text inside the speech bubbles.
            </li>
            <li>Three translation variations are generated so you can choose the best one.</li>
            <li>Download your favourite — no account or signup required.</li>
          </ol>
        </section>

        <section className="space-y-3 text-gray-600 leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">Daily limit</h2>
          <p>
            To keep the service free for everyone, each visitor gets 10 free uses per day (the
            &ldquo;Both&rdquo; mode costs 2 uses). The count resets at midnight UTC.
          </p>
        </section>

        <section className="space-y-3 text-gray-600 leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">Privacy</h2>
          <p>
            Uploaded images are processed in memory and never stored. See our{' '}
            <a href="/privacy" className="text-accent-600 hover:underline">
              Privacy Policy
            </a>{' '}
            for details.
          </p>
        </section>

        <section className="space-y-3 text-gray-600 leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">Limitations</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Output images may be resized by the AI model.</li>
            <li>Handwritten or highly stylised text may not always be detected correctly.</li>
            <li>Sound effects are translated as best-effort approximations.</li>
            <li>Results depend on the quality and clarity of the uploaded panel.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
