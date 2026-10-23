import type { BookReview, ChapterDiscussion, ChapterThreadInfo, DiscussionsResponse, PassageQuote, Post } from '../types'

export interface DiscussionsState {
  /** chapterIndex -> the comment-section content to show after that chapter. */
  chapterDiscussions: Map<number, ChapterDiscussion>
  reviews: BookReview[]
}

export const EMPTY_DISCUSSIONS: DiscussionsState = {
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

/** A real, always-working link to Reddit's own search — the honest
 * fallback when we have no matched quotes or threads for a book/chapter
 * (no credentials configured, or genuinely nothing found). */
export function redditSearchUrl(title: string, author: string, extra?: string): string {
  const q = [title, author, extra].filter(Boolean).join(' ')
  return `https://www.reddit.com/search/?q=${encodeURIComponent(q)}`
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

export function buildDiscussionsState(posts: Post[], data: DiscussionsResponse | null): DiscussionsState {
  if (!data) return EMPTY_DISCUSSIONS
  return {
    chapterDiscussions: groupByChapter(posts, data.quotes, data.chapterThreads),
    reviews: data.reviews,
  }
}
