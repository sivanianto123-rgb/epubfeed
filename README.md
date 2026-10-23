# epubfeed

Read any EPUB the way you scroll Twitter/X — dark mode, one chunk of prose per "post," infinite scroll, chapter dividers, and your progress saved automatically.

The reader itself runs entirely client-side. Your books never leave your device: they're parsed locally and stored in IndexedDB. The optional "what other readers think" feature (below) is the one piece that needs a server, since it talks to Reddit/Hardcover with API secrets that can't live in client-side code.

## Features

- **Drop in an .epub, or paste a link** — parsed entirely in-browser (via [JSZip](https://stuk.github.io/jszip/)), no upload. A URL is fetched directly from your browser, so the host needs to allow cross-origin requests (CORS) for it to work
- **Real chapters only** — front/back matter (titlepage, imprint, colophon, etc.) is detected via EPUB3 `epub:type` semantics and skipped, so the book opens on its first real chapter
- **Feed-ified prose** — chapters are chunked into ~280-character "posts." The splitter is quote-aware, so a line of dialogue is never torn apart mid-quote (long ones get a "Show more" toggle instead of being cut up)
- **Formatting preserved** — italics/bold from the source render as real emphasis; footnote/endnote markers are stripped so they don't leak stray digits into the prose
- **Dark, X-style UI** — avatar (book cover), display name (author), handle (derived from the book title), a connecting thread line between posts in the same chapter, and a "Chapter · Nm left" meta line
- **Infinite scroll** — posts render in batches as you scroll
- **Real progress** — word-weighted (not post-count), consistent between the library list and the in-feed header; reading position is saved per book and restored on reopen
- **Highlights** — star a passage (`☆ Highlight`) and it's remembered per book; `💬 N readers` is a flavor count, not a real tally
- **Library** — every book you upload stays in your local library (IndexedDB) with a progress bar
- **Keyboard nav** — `j`/`k` or arrow keys to step through posts
- **What other readers think** (optional, needs setup — see below) — reader comments that quote a passage show up attached to that exact post; chapter-discussion threads unlock once you've read that far; whole-book reviews appear only at the end, to avoid spoilers

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL and drop in an `.epub` file.

### Build

```bash
npm run build
npm run preview
```

## "What other readers think" — setup

This feature needs a backend (Reddit's OAuth secret can't be shipped to the browser), so it's built as Vercel serverless functions (`api/`) alongside the static frontend. **Without any setup it still works** — `/api/discussions` returns clearly-labeled demo data so the UI is fully testable before you have real credentials.

To go live:

1. **Reddit**: create a "script" app at [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps), then set `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `REDDIT_USER_AGENT` (see `.env.example`). Free tier is 100 queries/min, non-commercial — responses are cached for a week at Vercel's edge (`Cache-Control: s-maxage=604800`), so a personal reader stays well within that.
2. **Hardcover** (optional, for whole-book reviews): get a token from [docs.hardcover.app/api/getting-started](https://docs.hardcover.app/api/getting-started) and set `HARDCOVER_API_TOKEN`. Their API is in beta and the schema has shifted before — `api/_lib/hardcover.ts` has a best-effort query that's clearly marked as needing verification against a real response once you have a token.
3. Deploy to Vercel and add those as **Environment Variables** in the project settings — never commit them (`.env` is gitignored).

**How matching works:**
- A Reddit comment that quotes the book (`> ...` or `"..."`) is fingerprinted (word-shingle overlap) and attached to the exact post containing that passage.
- Chapter-discussion threads (like r/bookclub's "Chapters 1–5") attach to the divider of the chapter *after* the range they cover, so they only appear once you've read that far.
- Whole-book reviews appear only once you've scrolled to the end of the feed, since they're the most likely to spoil.
- Everything else is dropped — an unmatched comment is exactly where a spoiler would hide.

**Known limitations:**
- Passage-level matches will be sparse for most books — only some readers quote text directly. Popular classics with active r/bookclub read-alongs will have the most.
- Goodreads isn't supported: they stopped issuing new developer keys in December 2020 and scraping violates their terms.
- The Hardcover query is unverified against live data (see above) — treat `api/_lib/hardcover.ts` as a starting point, not a guarantee.
- This sandbox couldn't reach either API to test live calls (network policy), so the Reddit integration is implemented per their documented API but only tested end-to-end in mock mode. Verify it once deployed.

## How it works

- `src/lib/epubParser.ts` — unzips the EPUB, reads `container.xml` → the OPF package document (metadata, manifest, spine, cover), skips front/back matter, and extracts paragraph-level rich text (preserving emphasis, stripping footnote markers) from each spine chapter's XHTML
- `src/lib/chunk.ts` — turns each chapter's paragraphs into feed "posts": a quote-aware sentence splitter packs text up to 280 chars without tearing dialogue apart, and attaches a per-post "minutes left in chapter" estimate
- `src/lib/progress.ts` — word-weighted reading progress, shared between the library list and the in-feed header
- `src/lib/library.ts` — persists parsed books, reading progress, and highlights to IndexedDB via [idb-keyval](https://github.com/jakearchibald/idb-keyval)
- `src/lib/discussions.ts` — fetches `/api/discussions` and fingerprint-matches reader quotes to specific posts (falls back to synthesized demo data when the backend has no credentials configured)
- `src/components/Feed.tsx` — the scrollable feed: batched rendering, an `IntersectionObserver` for infinite-load, another for tracking/saving reading position, and a dedicated end-of-feed detector for unlocking reviews
- `src/components/PostCard.tsx` — the individual "tweet" — avatar, name/handle, rich text with "Show more," reply/readers/highlight/share actions, and an attached reader-quote card when there's a match
- `api/discussions.ts` + `api/_lib/` — the Vercel serverless function: Reddit OAuth (app-only, no user login needed) + search + comment-quote extraction, Hardcover GraphQL (best-effort), and the demo-data fallback

## Stack

React + TypeScript + Vite for the frontend (no backend required for the core reader). Vercel serverless functions for the optional discussions feature.
