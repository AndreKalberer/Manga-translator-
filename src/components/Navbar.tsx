import Link from 'next/link';
import { QuotaInfo } from '@/types';
import QuotaBadge from './QuotaBadge';

interface NavbarProps {
  quota?: QuotaInfo | null;
}

export default function Navbar({ quota }: NavbarProps) {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-1.5 font-black text-lg tracking-tight shrink-0">
          <span className="text-accent-600">Manga</span>
          <span className="text-gray-900">Translate</span>
        </Link>

        <div className="flex items-center gap-4">
          {quota !== undefined && <QuotaBadge quota={quota ?? null} />}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <Link href="/about" className="hover:text-gray-900 transition-colors">
              About
            </Link>
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
