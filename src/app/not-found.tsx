import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Not found — MangaTL',
};

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-accent-100 text-accent-600 mx-auto mb-5 flex items-center justify-center text-2xl font-black">
            404
          </div>
          <h1 className="text-xl font-black text-gray-900 mb-2">Page not found</h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            The page you&apos;re looking for doesn&apos;t exist or has moved.
          </p>
          <a
            href="/"
            className="inline-block px-5 py-2.5 rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold transition-colors"
          >
            Back to home
          </a>
        </div>
      </main>
    </div>
  );
}
