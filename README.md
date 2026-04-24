# MangaTL

AI-powered translator for manga, manhwa, and manhua panels. Upload a panel; get a
publication-quality English translation rendered back into the original bubbles.

**Live:** <https://manga-tl-andres-projects-edc54d3b.vercel.app>
_(Update this link if the Vercel project or team slug is renamed.)_

## Why not just use ChatGPT?

ChatGPT with vision can read text from a panel and translate it. But it stops
there — you get a wall of English text, not a finished panel. MangaTL is built
end-to-end for the full workflow:

- **You get a finished panel, not just text.** ChatGPT won't redraw the panel
  with the English inside the bubbles. You'd have to Photoshop the translations
  back in yourself. MangaTL hands you back a publication-ready translated
  panel with the text lettered into the original bubble shapes.
- **Purpose-built for manga, manhwa, and manhua.** The translator prompt is
  engineered for character voice matching (arrogant stays haughty, sarcastic
  stays biting), bubble-kind awareness (speech vs thought vs SFX vs narration),
  and publication-quality localized English in the style of Viz Media or Yen
  Press — not literal machine translation.
- **Free.** 10 translations per day with no account. ChatGPT's image-in /
  image-out workflow requires Plus at \$20/month.
- **Batch upload.** Queue up to 10 panels; they process sequentially with a
  progress bar for each. ChatGPT forces one-at-a-time conversation.
- **Automatic screenshot cropping.** Upload a panel with browser chrome, phone
  status bars, or reader-app UI around it — we crop to the panel automatically.
  ChatGPT reproduces the whole screenshot.
- **Paste from clipboard.** Cmd/Ctrl+V anywhere. No file-picker click-through.
- **Transcript included.** Get the bubble-by-bubble breakdown with speaker
  notes and original text alongside the rendered panel — great for learning
  the source language or double-checking nuance.
- **No prompt engineering.** Drop the panel in. Don't have to explain what
  manga is, what voice matching is, or remember to ask for the image back.

## What it does

- **Two-stage pipeline.** A vision LLM (`gpt-5.2`) reads the panel, identifies every
  speech bubble, thought bubble, SFX, and side text, and produces a localized English
  transcript with per-character voice notes. An image model (`gpt-image-2-2026-04-21`)
  then renders the panel with that English text lettered into the original bubble
  positions, preserving art, composition, and bubble shapes.
- **Three modes.** `translate` (text only), `color` (colorize only), `both`
  (colorize + translate, costs 2 uses).
- **Screenshot-aware.** If the upload includes browser chrome, phone status bars,
  or reader-app UI, the model crops to the panel and ignores the rest.
- **Daily free limit.** 10 uses / UTC day per client, persisted in an HMAC-signed
  cookie so it survives reloads and cold starts.

## Tech stack

- **Next.js 15** (App Router) on the Node.js runtime.
- **OpenAI SDK** for both the translator and image model.
- **sharp** for input normalization (resize to 1500px, PNG-encode).
- **Zod** for structured-output validation on the translator.
- **Tailwind** with a coral accent palette for styling.

No database. State lives in signed cookies (daily quota) and process memory (burst
limiter).

## Local development

### Prerequisites

- Node.js 20+
- An OpenAI API key with billing enabled (both `gpt-5.2` and the image model require
  a verified org with billing).

### Setup

```bash
npm install
cp .env.example .env.local
# edit .env.local — at minimum, set OPENAI_API_KEY and QUOTA_SECRET
npm run dev
```

The dev server runs on <http://localhost:3000>.

### Environment variables

| Name | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Yes | API key for translator + image calls |
| `QUOTA_SECRET` | Yes | 16+ char random string for HMAC-signing the daily quota cookie. Generate with `openssl rand -hex 32` |
| `NEXT_PUBLIC_SITE_URL` | Yes in prod | Production URL (no trailing slash). Required by the origin allowlist in `/api/translate` — without it, browser POSTs from the site are 403'd |
| `DEBUG_TOKEN` | Recommended | Random token. `/api/debug` returns 404 without `Authorization: Bearer <value>` |
| `OPENAI_IMAGE_MODEL` | No | Override the image model (default `gpt-image-2-2026-04-21`) |
| `OPENAI_TRANSLATOR_MODEL` | No | Override the translator model (default `gpt-5.2`) |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | No | AdSense publisher ID (`ca-pub-XXXXXXXXXXXXXXXX`). Without it, ad slots render nothing in production |

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── translate/route.ts   SSE-streaming pipeline: validate → sharp → translator → image gen
│   │   ├── quota/route.ts       GET: peek remaining uses (no consumption)
│   │   └── debug/route.ts       Token-gated diagnostics (API key presence, model list, image-edit smoke test)
│   ├── about/                   About page
│   ├── privacy/                 Privacy policy
│   ├── terms/                   Terms of service
│   ├── layout.tsx               Root layout, SEO metadata, JSON-LD, AdSense bootstrap
│   ├── page.tsx                 Landing page + client SSE consumer + queue
│   ├── robots.ts                Crawler rules
│   └── sitemap.ts               Sitemap for SEO
├── components/                  Navbar, UploadZone, ModeSelector, ProgressBar, ImageResultCard, etc.
├── lib/
│   ├── translator.ts            gpt-5.2 structured-output call, returns PanelAnalysis
│   ├── render.ts                gpt-image-2 image-edit call, with injection-safe framing
│   ├── quota.ts                 Signed-cookie daily quota + in-memory burst limiter
│   ├── ip.ts                    Client IP extraction (prefers x-vercel-forwarded-for)
│   ├── log.ts                   Structured security-event logging (hashed IPs)
│   ├── openai.ts                OpenAI client singleton
│   └── utils.ts                 withRetry helper
├── middleware.ts                Per-request CSP nonce; drops 'unsafe-inline' from script-src
└── types/index.ts               Shared types (Mode, PanelAnalysis, ProcessedImage)
```

## Deployment

Deploys to Vercel. Configured for the Node.js runtime with `maxDuration = 300`
(requires Vercel Pro; Hobby caps at 60s).

After `git push origin main`, Vercel builds automatically if the project is
connected. Before the first production deploy, set all required env vars in
**Settings → Environment Variables** and set **Settings → Git → Production
Branch** to `main`.

## Security notes

- **CSP nonce middleware** (`src/middleware.ts`) generates a per-request nonce and
  sets a strict Content-Security-Policy header that drops `'unsafe-inline'` from
  `script-src`. Next.js's runtime scripts and our JSON-LD/AdSense tags carry the
  nonce; everything else is blocked.
- **Origin allowlist** on `/api/translate` rejects cross-origin POSTs so the
  OpenAI budget can't be drained by anonymous cross-site abuse.
- **HMAC-signed daily-quota cookie** (`mtq`, HttpOnly + Secure + SameSite=Lax,
  expires at UTC midnight). Forging requires `QUOTA_SECRET`.
- **Per-minute burst limiter** runs in memory (best-effort, per-Vercel-instance).
  Stronger guarantees would need Vercel KV.
- **File validation before quota consumption**: malformed uploads don't burn user
  quota. Instance check, MIME check, size cap, and magic-byte signature check all
  run before `checkAndConsume()`.
- **`/api/debug`** is Bearer-token gated and returns 404 without a valid
  `DEBUG_TOKEN`. Also omits the OpenAI API key prefix from responses.
- **Structured security logging** with one-way SHA-256(IP) hashes so abuse can be
  correlated without storing raw addresses.

## License

All rights reserved. Not open-source. Do not copy or redistribute.
