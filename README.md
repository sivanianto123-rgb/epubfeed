# epubfeed

Read any EPUB the way you scroll Twitter/X — dark mode, one chunk of prose per "post," infinite scroll, chapter dividers, and your progress saved automatically.

Everything runs client-side in the browser. Your books never leave your device: they're parsed locally and stored in IndexedDB.

## Features

- **Drop in an .epub, or paste a link** — parsed entirely in-browser (via [JSZip](https://stuk.github.io/jszip/)), no server, no upload. A URL is fetched directly from your browser, so the host needs to allow cross-origin requests (CORS) for it to work
- **Feed-ified prose** — chapters are chunked into tweet-sized "posts," with chapter headings rendered as pinned dividers
- **Dark, X-style UI** — avatar (book cover), display name (title), handle (derived from the author), fake-but-deterministic like/retweet/reply counts for flavor
- **Infinite scroll** — posts render in batches as you scroll
- **Resume where you left off** — reading position is saved per book (debounced + saved on navigating away) and restored on reopen
- **Library** — every book you upload stays in your local library (IndexedDB) with a progress bar
- **Keyboard nav** — `j`/`k` or arrow keys to step through posts

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

## How it works

- `src/lib/epubParser.ts` — unzips the EPUB, reads `container.xml` → the OPF package document (metadata, manifest, spine, cover), and extracts paragraph-level text from each spine chapter's XHTML
- `src/lib/chunk.ts` — turns each chapter's paragraphs into feed "posts": short paragraphs get combined, long ones are split on sentence boundaries, headings become chapter-divider posts
- `src/lib/library.ts` — persists parsed books and reading progress to IndexedDB via [idb-keyval](https://github.com/jakearchibald/idb-keyval)
- `src/components/Feed.tsx` — the scrollable feed: batched rendering, an `IntersectionObserver` for infinite-load, and another for tracking/saving the topmost visible post as reading progress
- `src/components/PostCard.tsx` — the individual "tweet" — avatar, name/handle, text, and reply/retweet/like/share actions (like/retweet are locally interactive, for feel)

## Stack

React + TypeScript + Vite, no backend.
