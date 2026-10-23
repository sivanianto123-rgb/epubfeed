import type { Post } from '../types'

export function wordCount(text: string): number {
  const plain = text.replace(/[_*]/g, '')
  return plain.trim() ? plain.trim().split(/\s+/).length : 0
}

export interface CumulativeWords {
  /** cumulativeWords[i] = total content words from post 0 through post i. */
  cumulative: number[]
  total: number
}

export function buildCumulativeWords(posts: Post[]): CumulativeWords {
  let total = 0
  const cumulative = new Array<number>(posts.length)
  posts.forEach((post, i) => {
    if (post.type === 'text') total += wordCount(post.text)
    cumulative[i] = total
  })
  return { cumulative, total }
}

/** Word-weighted reading progress (0-100), more accurate than a raw
 * post-index ratio since posts vary a lot in length. Heading/divider
 * posts don't count as "content" read. */
export function computeWordProgress(posts: Post[], currentIndex: number): number {
  if (currentIndex < 0 || posts.length === 0) return 0
  const { cumulative, total } = buildCumulativeWords(posts)
  if (total === 0) return 0
  const clampedIndex = Math.min(currentIndex, posts.length - 1)
  return Math.min(100, Math.round((cumulative[clampedIndex] / total) * 100))
}
