'use client';

import { useEffect } from 'react';
import Navbar from '@/components/Navbar';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-accent-100 text-accent-600 mx-auto mb-5 flex items-center justify-center text-3xl font-black">
            !
          </div>
          <h1 className="text-xl font-black text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            The page hit an unexpected error. Try again, or head back to the home page.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold transition-colors"
            >
              Try again
            </button>
            <a
              href="/"
              className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
            >
              Back to home
            </a>
          </div>
          {error.digest && (
            <p className="text-[11px] text-gray-300 mt-5 font-mono">ref: {error.digest}</p>
          )}
        </div>
      </main>
    </div>
  );
}
