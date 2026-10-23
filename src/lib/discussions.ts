import type { BookReview, ChapterThreadInfo, DiscussionsResponse, PassageQuote, Post } from '../types'

const MOCK_REACTIONS = [
  'I had to read this line three times.',
  'This is the one everyone quotes.',
  'Okay, this hit different.',
  'Reread this paragraph like five times.',
  'This is where the book really starts for me.',
  'Still thinking about this line a week later.',
]

export interface DiscussionsState {
  mock: boolean
  /** postIndex -> the reader comment quoting that passage. */
  passageMatches: Map<number, PassageQuote>
  /** chapterIndex of the divider it should render on -> the thread. */
  chapterThreads: Map<number, ChapterThreadInfo>
  reviews: BookReview[]
}

export const EMPTY_DISCUSSIONS: DiscussionsState = {
  mock: false,
  passageMatches: new Map(),
  chapterThreads: new Map(),
  reviews: [],
}

export async function fetchDiscussions(title: string, author: string): Promise<DiscussionsResponse | null> {
  try {
    const params = new URLSearchParams({ title, author })
    const res = await fetch(`/api/discussions?${params.toString()}`)
    if (!res.ok) return null
    return (await res.json()) as DiscussionsResponse
  } catch {
    return null
  }
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_*]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function shingles(text: string, size = 8): Set<string> {
  const words = normalize(text).split(' ').filter(Boolean)
  const set = new Set<string>()
  for (let i = 0; i + size <= words.length; i++) {
    set.add(words.slice(i, i + size).join(' '))
  }
  if (set.size === 0 && words.length > 0) set.add(words.join(' '))
  return set
}

function containmentRatio(quote: Set<string>, passage: Set<string>): number {
  if (quote.size === 0 || passage.size === 0) return 0
  let hits = 0
  for (const s of quote) if (passage.has(s)) hits++
  return hits / quote.size
}

/** Matches each reader quote to the single post it most likely came from.
 * Sparse by design: most quotes won't clear the threshold, and that's
 * fine — a wrong match is worse than no match. */
function matchPassages(posts: Post[], quotes: PassageQuote[]): Map<number, PassageQuote> {
  const matches = new Map<number, PassageQuote>()
  const postShingles = posts.map((p) => (p.type === 'text' ? shingles(p.text) : null))

  for (const quote of quotes) {
    const quoteShingles = shingles(quote.text)
    if (quoteShingles.size === 0) continue
    let bestIndex = -1
    let bestScore = 0
    postShingles.forEach((s, i) => {
      if (!s || s.size === 0 || matches.has(i)) return
      const score = containmentRatio(quoteShingles, s)
      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    })
    if (bestIndex >= 0 && bestScore >= 0.5) {
      matches.set(bestIndex, quote)
    }
  }
  return matches
}

function mapChapterThreads(threads: ChapterThreadInfo[]): Map<number, ChapterThreadInfo> {
  const map = new Map<number, ChapterThreadInfo>()
  for (const thread of threads) {
    // throughChapter is 1-based; it should surface on the divider of the
    // *next* chapter (0-based index === throughChapter), so the reader has
    // already finished everything the thread discusses.
    const showAtChapterIndex = thread.throughChapter
    if (showAtChapterIndex < 1) continue
    if (!map.has(showAtChapterIndex)) map.set(showAtChapterIndex, thread)
  }
  return map
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function synthesizeMock(posts: Post[]): Omit<DiscussionsState, 'mock'> {
  const passageMatches = new Map<number, PassageQuote>()
  posts.forEach((post, i) => {
    if (post.type !== 'text') return
    if (hashString(`${i}`) % 17 !== 3) return
    passageMatches.set(i, {
      text: MOCK_REACTIONS[hashString(post.text) % MOCK_REACTIONS.length],
      permalink: '#',
      subreddit: 'demo',
      author: 'demo_reader',
    })
  })

  const chapterThreads = new Map<number, ChapterThreadInfo>()
  const chapterIndices = Array.from(new Set(posts.map((p) => p.chapterIndex))).sort((a, b) => a - b)
  chapterIndices.forEach((ci, i) => {
    if (i === 0 || i % 2 !== 1) return
    chapterThreads.set(ci, {
      title: 'Demo discussion thread',
      permalink: '#',
      subreddit: 'demo',
      throughChapter: ci,
    })
  })

  const reviews: BookReview[] = [
    { text: 'A tight, well-paced read start to finish. (Demo review — connect Hardcover to see real ones.)', rating: 4, permalink: null },
    { text: 'The ending surprised me more than I expected. (Demo review.)', rating: 5, permalink: null },
  ]

  return { passageMatches, chapterThreads, reviews }
}

export function buildDiscussionsState(posts: Post[], data: DiscussionsResponse | null): DiscussionsState {
  if (!data) return EMPTY_DISCUSSIONS
  if (data.mock) {
    return { mock: true, ...synthesizeMock(posts) }
  }
  return {
    mock: false,
    passageMatches: matchPassages(posts, data.quotes),
    chapterThreads: mapChapterThreads(data.chapterThreads),
    reviews: data.reviews,
  }
}
