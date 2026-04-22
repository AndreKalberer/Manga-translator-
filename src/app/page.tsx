'use client';

import { useState, useCallback, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import UploadZone from '@/components/UploadZone';
import ImageResultCard from '@/components/ImageResultCard';
import ProgressBar from '@/components/ProgressBar';
import AdUnit from '@/components/AdUnit';
import { ProcessedImage, QuotaInfo, Mode } from '@/types';

type AppStatus = 'idle' | 'processing' | 'done';

const MODE_LABELS: Record<Mode, string> = {
  translate: 'Translation',
  color: 'Colorization',
  both: 'Translation + Color',
};

export default function HomePage() {
  const [status, setStatus] = useState<AppStatus>('idle');
  const [queue, setQueue] = useState<ProcessedImage[]>([]);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [mode, setMode] = useState<Mode>('translate');

  // Fetch quota on mount
  useEffect(() => {
    fetch('/api/quota')
      .then((r) => r.json())
      .then((data: QuotaInfo) => setQuota(data))
      .catch(() => null);
  }, []);

  const updateImage = useCallback((id: string, patch: Partial<ProcessedImage>) => {
    setQueue((prev) =>
      prev.map((img) => (img.imageId === id ? { ...img, ...patch } : img))
    );
  }, []);

  const processFile = async (file: File, imageId: string, fileMode: Mode): Promise<void> => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('mode', fileMode);

    const response = await fetch('/api/translate', { method: 'POST', body: formData });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      let message = 'Server error';
      try {
        const parsed = JSON.parse(text);
        message = parsed.error ?? message;
        if (response.status === 429 && parsed.remaining !== undefined) {
          setQuota((prev) =>
            prev ? { ...prev, remaining: parsed.remaining, resetAt: parsed.resetAt } : null
          );
        }
      } catch { /* plain text */ }
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
        try { event = JSON.parse(raw); } catch { continue; }

        const step = event.step as string;

        if (step === 'analyzing') {
          updateImage(imageId, { status: 'analyzing' });
        } else if (step === 'rendering') {
          updateImage(imageId, { status: 'rendering' });
        } else if (step === 'done') {
          updateImage(imageId, {
            status: 'done',
            originalDataUrl: event.originalDataUrl as string,
            variations: event.variations as ProcessedImage['variations'],
            selectedIndex: 0,
            analysis: event.analysis as ProcessedImage['analysis'],
          });
          if (event.remaining !== undefined) {
            setQuota((prev) =>
              prev
                ? { ...prev, remaining: event.remaining as number, resetAt: event.resetAt as string }
                : null
            );
          }
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
    const currentMode = mode;
    const entries: ProcessedImage[] = files.map((file) => ({
      imageId: crypto.randomUUID(),
      originalFileName: file.name,
      originalDataUrl: '',
      variations: [],
      selectedIndex: 0,
      status: 'pending',
      mode: currentMode,
    }));

    setQueue((prev) => [...prev, ...entries]);
    setStatus('processing');

    for (let i = 0; i < files.length; i++) {
      await processFile(files[i], entries[i].imageId, currentMode);
    }

    setStatus('done');
  };

  const isProcessing = status === 'processing';
  const quotaExhausted = quota !== null && quota.remaining === 0;

  const headerSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_HEADER ?? 'header';
  const sidebarSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR ?? 'sidebar';

  const doneResults = queue.filter((img) => img.status === 'done');
  const inProgressItems = queue.filter((img) => img.status !== 'done');

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar quota={quota} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-4 pt-2">
          <div className="inline-flex items-center gap-2 bg-accent-50 border border-accent-100 text-accent-700 text-xs font-semibold px-3 py-1 rounded-full">
            Japanese · Korean · Chinese
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-gray-900 leading-none">
            Translate &amp; colorize<br />
            <span className="text-accent-600">your manga panels</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-md mx-auto leading-relaxed">
            Choose a mode, drop in your panels, and get 3 options to pick from.
          </p>
        </div>

        {/* Header ad */}
        <AdUnit slot={headerSlot} format="horizontal" className="h-[90px] w-full rounded-xl overflow-hidden" />

        {/* Upload zone */}
        <section className="max-w-xl mx-auto">
          <UploadZone
            onSubmit={handleSubmit}
            mode={mode}
            onModeChange={setMode}
            disabled={isProcessing}
            quotaExhausted={quotaExhausted}
            remaining={quota?.remaining}
          />
        </section>

        {/* Processing queue */}
        {inProgressItems.length > 0 && (
          <section className="max-w-xl mx-auto space-y-2">
            {inProgressItems.map((img) => (
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
        {doneResults.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Results</h2>
              <span className="text-sm text-gray-400">
                {doneResults.length} panel{doneResults.length !== 1 ? 's' : ''} processed
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {doneResults.map((img) => (
                <ImageResultCard
                  key={img.imageId}
                  result={img}
                  modeLabel={MODE_LABELS[img.mode]}
                />
              ))}
            </div>

            <AdUnit
              slot={sidebarSlot}
              format="rectangle"
              className="h-[250px] w-full max-w-sm mx-auto rounded-xl overflow-hidden"
            />
          </section>
        )}

        {queue.length === 0 && (
          <p className="text-center text-gray-400 text-sm">
            Each panel generates 3 options — pick whichever looks best.
          </p>
        )}
      </main>
    </div>
  );
}
