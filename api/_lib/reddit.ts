import type { ChapterThreadInfo, PassageQuote } from './types.js'

const USER_AGENT = process.env.REDDIT_USER_AGENT || 'epubfeed/1.0 (personal reading app)'
const MAX_SUBMISSIONS = 6
const MAX_QUOTES = 30

interface RedditToken {
  token: string
  expiresAt: number
}

// Best-effort cache across warm serverless invocations. Not guaranteed to
// persist (cold starts get a fresh module scope), just an optimization.
let cachedToken: RedditToken | null = null

async function getToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID
  const secret = process.env.REDDIT_CLIENT_SECRET
  if (!id || !secret) return null
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token

  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    throw new Error(`Reddit token request failed: ${res.status} ${await res.text().catch(() => '')}`)
  }
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + Math.max(60, data.expires_in - 60) * 1000 }
  return cachedToken.token
}

async function redditGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://oauth.reddit.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT },
  })
  if (!res.ok) throw new Error(`Reddit API error ${res.status} for ${path}`)
  return res.json() as Promise<T>
}

interface RedditListing<T> {
  data: { children: { data: T }[] }
}

interface RedditSubmission {
  id: string
  title: string
  permalink: string
  subreddit: string
  num_comments: number
}

interface RedditCommentData {
  body?: string
  author?: string
  permalink?: string
  score?: number
  replies?: RedditListing<RedditCommentData> | ''
}

const CHAPTER_RANGE_RE = /chapters?\s*(\d+)\s*(?:[-–—]|to|through)\s*(\d+)/i
const CHAPTER_SINGLE_RE = /chapter\s*(\d+)\b/i
const QUOTE_RE = /"([^"\n]{20,400})"|“([^”\n]{20,400})”/g
const BLOCKQUOTE_RE = /^>\s?(.{20,400})$/gm

function extractQuotesFromBody(body: string): string[] {
  const found = new Set<string>()
  let m: RegExpExecArray | null
  QUOTE_RE.lastIndex = 0
  while ((m = QUOTE_RE.exec(body))) {
    const text = (m[1] || m[2] || '').trim()
    if (text) found.add(text)
  }
  BLOCKQUOTE_RE.lastIndex = 0
  while ((m = BLOCKQUOTE_RE.exec(body))) {
    const text = m[1].trim()
    if (text) found.add(text)
  }
  return Array.from(found)
}

function flattenComments(listing: RedditListing<RedditCommentData> | undefined, depth = 0): RedditCommentData[] {
  if (!listing || depth > 2) return []
  const out: RedditCommentData[] = []
  for (const child of listing.data.children) {
    const c = child.data
    if (c.body) out.push(c)
    if (c.replies && typeof c.replies !== 'string') {
      out.push(...flattenComments(c.replies, depth + 1))
    }
  }
  return out
}

function parseThroughChapter(title: string): number | null {
  const range = CHAPTER_RANGE_RE.exec(title)
  if (range) return Math.max(Number(range[1]), Number(range[2]))
  const single = CHAPTER_SINGLE_RE.exec(title)
  if (single) return Number(single[1])
  return null
}

export async function searchRedditDiscussions(
  title: string,
  author: string,
): Promise<{ quotes: PassageQuote[]; chapterThreads: ChapterThreadInfo[] }> {
  const token = await getToken()
  if (!token) return { quotes: [], chapterThreads: [] }

  const query = encodeURIComponent(author ? `"${title}" ${author}` : `"${title}"`)
  const search = await redditGet<RedditListing<RedditSubmission>>(
    token,
    `/search?q=${query}&type=link&sort=relevance&limit=${MAX_SUBMISSIONS * 3}&restrict_sr=false`,
  )
  const submissions = search.data.children.map((c) => c.data).slice(0, MAX_SUBMISSIONS)

  const chapterThreads: ChapterThreadInfo[] = []
  const quotes: PassageQuote[] = []

  for (const sub of submissions) {
    const throughChapter = parseThroughChapter(sub.title)
    if (throughChapter) {
      chapterThreads.push({
        title: sub.title,
        permalink: `https://reddit.com${sub.permalink}`,
        subreddit: sub.subreddit,
        throughChapter,
      })
    }

    if (quotes.length >= MAX_QUOTES || sub.num_comments === 0) continue
    try {
      const [, commentsListing] = await redditGet<[unknown, RedditListing<RedditCommentData>]>(
        token,
        `/r${sub.permalink}?limit=50&depth=2`,
      )
      const comments = flattenComments(commentsListing)
      for (const comment of comments) {
        if (quotes.length >= MAX_QUOTES) break
        if (!comment.body) continue
        for (const text of extractQuotesFromBody(comment.body)) {
          if (quotes.length >= MAX_QUOTES) break
          quotes.push({
            text,
            permalink: comment.permalink
              ? `https://reddit.com${comment.permalink}`
              : `https://reddit.com${sub.permalink}`,
            subreddit: sub.subreddit,
            author: comment.author || 'unknown',
          })
        }
      }
    } catch {
      // One bad thread shouldn't sink the whole request.
      continue
    }
  }

  return { quotes, chapterThreads }
}
