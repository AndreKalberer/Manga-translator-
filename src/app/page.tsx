'use client';

import { useState, useCallback } from 'react';
import UploadZone from '@/components/UploadZone';
import ImageResultCard from '@/components/ImageResultCard';
import ProgressBar from '@/components/ProgressBar';
import AdUnit from '@/components/AdUnit';
import { ProcessedImage } from '@/types';

type AppStatus = 'idle' | 'processing' | 'done';

export default function HomePage() {
  const [status, setStatus] = useState<AppStatus>('idle');
  const [queue, setQueue] = useState<ProcessedImage[]>([]);

  const updateImage = useCallback((id: string, patch: Partial<ProcessedImage>) => {
    setQueue((prev) =>
      prev.map((img) => (img.imageId === id ? { ...img, ...patch } : img))
    );
  }, []);

  const processFile = async (file: File, imageId: string): Promise<void> => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/translate', { method: 'POST', body: formData });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      let message = 'Server error';
      try {
        message = JSON.parse(text).error ?? message;
      } catch {
        // plain text error
      }
      updateImage(imageId, { status: 'error', errorMessage: message });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(raw);
        } catch {
          continue;
        }

        const step = event.step as string;

        if (step === 'rendering') {
          updateImage(imageId, { status: 'rendering' });
        } else if (step === 'done') {
          updateImage(imageId, {
            status: 'done',
            originalDataUrl: event.originalDataUrl as string,
            variations: event.variations as ProcessedImage['variations'],
            selectedIndex: 0,
          });
        } else if (step === 'error') {
          updateImage(imageId, {
            status: 'error',
            errorMessage: (event.message as string) ?? 'Unknown error',
          });
        }
      }
    }
  };

  const handleSubmit = async (files: File[]) => {
    // Build initial queue entries
    const entries: ProcessedImage[] = files.map((file) => ({
      imageId: crypto.randomUUID(),
      originalFileName: file.name,
      originalDataUrl: '',
      variations: [],
      selectedIndex: 0,
      status: 'pending',
    }));

    setQueue((prev) => [...prev, ...entries]);
    setStatus('processing');

    // Process sequentially to avoid rate limits
    for (let i = 0; i < files.length; i++) {
      await processFile(files[i], entries[i].imageId);
    }

    setStatus('done');
  };

  const isProcessing = status === 'processing';

  const headerSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_HEADER ?? 'header';
  const sidebarSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR ?? 'sidebar';

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="text-center space-y-3 pt-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          <span className="text-brand-400">Manga</span> Translator
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Upload manga, manhwa, or manhua panels. Our AI translates the speech bubbles to English
          and gives you 3 variations to choose from.
        </p>
      </div>

      {/* Header ad */}
      <AdUnit slot={headerSlot} format="horizontal" className="h-[90px] w-full" />

      {/* Upload zone */}
      <section className="max-w-2xl mx-auto">
        <UploadZone onSubmit={handleSubmit} disabled={isProcessing} />
      </section>

      {/* Processing queue */}
      {queue.length > 0 && (
        <section className="max-w-2xl mx-auto space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Processing
          </h2>
          {queue
            .filter((img) => img.status !== 'done')
            .map((img) => (
              <ProgressBar
                key={img.imageId}
                fileName={img.originalFileName}
                status={img.status}
                errorMessage={img.errorMessage}
              />
            ))}
        </section>
      )}

      {/* Results */}
      {queue.some((img) => img.status === 'done') && (
        <section className="space-y-6">
          <h2 className="text-xl font-bold">Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {queue
              .filter((img) => img.status === 'done')
              .map((img) => (
                <ImageResultCard key={img.imageId} result={img} />
              ))}
          </div>

          {/* Mid-page ad after results */}
          <AdUnit slot={sidebarSlot} format="rectangle" className="h-[250px] w-full max-w-sm mx-auto" />
        </section>
      )}

      {/* Empty state hint */}
      {queue.length === 0 && (
        <div className="text-center text-gray-600 text-sm py-4">
          Supported: Japanese manga, Korean manhwa, Chinese manhua
        </div>
      )}
    </div>
  );
}
