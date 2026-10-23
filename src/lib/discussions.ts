import type { BookReview, ChapterDiscussion, ChapterThreadInfo, DiscussionsResponse, PassageQuote, Post } from '../types'

const MOCK_REACTIONS = [
  'I had to read this chapter three times.',
  'This is the one everyone quotes.',
  'Okay, this chapter hit different.',
  'Reread this ending like five times.',
  'This is where the book really starts for me.',
  'Still thinking about this chapter a week later.',
]

export interface DiscussionsState {
  mock: boolean
  /** chapterIndex -> the comment-section content to show after that chapter. */
  chapterDiscussions: Map<number, ChapterDiscussion>
  reviews: BookReview[]
}

export const EMPTY_DISCUSSIONS: DiscussionsState = {
  mock: false,
  chapterDiscussions: new Map(),
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

/** Groups matched reader quotes and chapter-range threads by the chapter
 * they belong to, so the feed can render one comment section right after
 * each chapter ends. */
function groupByChapter(
  posts: Post[],
  quotes: PassageQuote[],
  threads: ChapterThreadInfo[],
): Map<number, ChapterDiscussion> {
  const passageMatches = matchPassages(posts, quotes)
  const commentsByChapter = new Map<number, PassageQuote[]>()
  passageMatches.forEach((quote, postIndex) => {
    const ci = posts[postIndex].chapterIndex
    const list = commentsByChapter.get(ci) || []
    list.push(quote)
    commentsByChapter.set(ci, list)
  })

  const threadByChapter = new Map<number, ChapterThreadInfo>()
  for (const thread of threads) {
    // throughChapter is 1-based ("Chapters 1-5" -> 5); the comment section
    // for that thread belongs after the 0-based chapter at index 4.
    const ci = thread.throughChapter - 1
    if (ci < 0) continue
    if (!threadByChapter.has(ci)) threadByChapter.set(ci, thread)
  }

  const chapterIndices = new Set<number>([...commentsByChapter.keys(), ...threadByChapter.keys()])
  const result = new Map<number, ChapterDiscussion>()
  for (const ci of chapterIndices) {
    result.set(ci, { comments: commentsByChapter.get(ci) || [], thread: threadByChapter.get(ci) })
  }
  return result
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
  const chapterIndices = Array.from(new Set(posts.map((p) => p.chapterIndex))).sort((a, b) => a - b)
  const chapterDiscussions = new Map<number, ChapterDiscussion>()

  chapterIndices.forEach((ci) => {
    const hasText = posts.some((p) => p.chapterIndex === ci && p.type === 'text')
    if (!hasText) return
    const seed = hashString(`chapter-${ci}`)
    chapterDiscussions.set(ci, {
      comments: [
        {
          text: MOCK_REACTIONS[seed % MOCK_REACTIONS.length],
          permalink: '#',
          subreddit: 'demo',
          author: 'demo_reader',
        },
      ],
      thread: { title: 'Demo discussion thread', permalink: '#', subreddit: 'demo', throughChapter: ci + 1 },
    })
  })

  const reviews: BookReview[] = [
    { text: 'A tight, well-paced read start to finish. (Demo review — connect Hardcover to see real ones.)', rating: 4, permalink: null },
    { text: 'The ending surprised me more than I expected. (Demo review.)', rating: 5, permalink: null },
  ]

  return { chapterDiscussions, reviews }
}

export function buildDiscussionsState(posts: Post[], data: DiscussionsResponse | null): DiscussionsState {
  if (!data) return EMPTY_DISCUSSIONS
  if (data.mock) {
    return { mock: true, ...synthesizeMock(posts) }
  }
  return {
    mock: false,
    chapterDiscussions: groupByChapter(posts, data.quotes, data.chapterThreads),
    reviews: data.reviews,
  }
}
