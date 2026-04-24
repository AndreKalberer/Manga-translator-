export default function HeroIllustration() {
  return (
    <div className="relative w-full h-full min-h-[320px] sm:min-h-[420px]">
      {/* Soft radial backdrop that matches the mockup's pink wash */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-accent-50 via-accent-100/70 to-accent-200/40"
      />

      {/* Decorative sakura petals */}
      <svg
        aria-hidden
        className="absolute top-8 left-6 w-6 h-6 text-accent-300/70 animate-float-soft"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 2c1.5 2.5 3.5 4 6 4-2.5 1-4 3-4 6-1-2.5-3-4-6-4 2.5-1 4-3 4-6z" />
      </svg>
      <svg
        aria-hidden
        className="absolute top-20 right-10 w-5 h-5 text-accent-300/60 animate-float-soft [animation-delay:1.5s]"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 2c1.5 2.5 3.5 4 6 4-2.5 1-4 3-4 6-1-2.5-3-4-6-4 2.5-1 4-3 4-6z" />
      </svg>
      <svg
        aria-hidden
        className="absolute bottom-16 left-12 w-4 h-4 text-accent-300/60 animate-float-soft [animation-delay:3s]"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 2c1.5 2.5 3.5 4 6 4-2.5 1-4 3-4 6-1-2.5-3-4-6-4 2.5-1 4-3 4-6z" />
      </svg>

      {/* Abstract panel silhouette in coral */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          viewBox="0 0 300 300"
          className="w-3/4 h-3/4 text-accent-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="40" y="30" width="130" height="85" rx="8" opacity="0.5" />
          <rect x="190" y="30" width="80" height="85" rx="8" opacity="0.4" />
          <rect x="40" y="130" width="80" height="140" rx="8" opacity="0.35" />
          <rect x="140" y="130" width="130" height="65" rx="8" opacity="0.5" />
          <rect x="140" y="210" width="130" height="60" rx="8" opacity="0.4" />
          <path
            d="M80 50 q0 -12 12 -12 h50 q12 0 12 12 v18 q0 12 -12 12 h-30 l-10 10 v-10 h-10 q-12 0 -12 -12 z"
            className="text-accent-400"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="white"
            opacity="0.85"
          />
          <circle cx="105" cy="57" r="1.8" fill="currentColor" className="text-accent-500" />
          <circle cx="115" cy="57" r="1.8" fill="currentColor" className="text-accent-500" />
          <circle cx="125" cy="57" r="1.8" fill="currentColor" className="text-accent-500" />
        </svg>
      </div>
    </div>
  );
}
