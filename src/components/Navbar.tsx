'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { QuotaInfo } from '@/types';
import QuotaBadge from './QuotaBadge';

interface NavbarProps {
  quota?: QuotaInfo | null;
}

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/#translate', label: 'Translate' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
];

export default function Navbar({ quota }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-accent-100/60 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg tracking-tight shrink-0"
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border-2 border-accent-400 text-accent-500">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z" />
              <path d="M20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z" />
            </svg>
          </span>
          <span className="text-gray-900">MangaTL</span>
        </Link>

        {/* Desktop nav. We only highlight pathname-based links (Home, About);
            the hash links don't reliably reflect scroll position without a
            scroll-spy and would be misleading if highlighted statically. */}
        <div className="hidden md:flex items-center gap-8 text-sm">
          {NAV_LINKS.map((link) => {
            const isPathLink = !link.href.includes('#');
            const active = isPathLink && pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative transition-colors ${
                  active
                    ? 'text-accent-500 after:absolute after:-bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:w-5 after:h-[2px] after:bg-accent-500 after:rounded-full'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-3 shrink-0">
          {quota !== undefined && <QuotaBadge quota={quota ?? null} />}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="md:hidden p-2 -mr-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6"
          >
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-accent-100/60 bg-white">
          <div className="max-w-6xl mx-auto px-5 py-4 flex flex-col gap-3 text-sm">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-gray-600 hover:text-gray-900 py-1.5"
              >
                {link.label}
              </Link>
            ))}
            {quota !== undefined && (
              <div className="pt-2 border-t border-gray-100">
                <QuotaBadge quota={quota ?? null} />
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
