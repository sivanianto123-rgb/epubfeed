import type { VercelRequest, VercelResponse } from '@vercel/node'
import { searchRedditDiscussions } from './_lib/reddit'
import { fetchHardcoverReviews } from './_lib/hardcover'
import { mockDiscussions } from './_lib/mock'
import type { DiscussionsResponse } from './_lib/types'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const title = typeof req.query.title === 'string' ? req.query.title.trim() : ''
  const author = typeof req.query.author === 'string' ? req.query.author.trim() : ''

  if (!title) {
    res.status(400).json({ error: 'Missing required "title" query parameter.' })
    return
  }

  const hasReddit = Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET)
  const hasHardcover = Boolean(process.env.HARDCOVER_API_TOKEN)

  if (!hasReddit && !hasHardcover) {
    // Cached briefly at the edge — this is static demo data, no need for a
    // long TTL, but no reason to refetch it on every request either.
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600')
    res.status(200).json(mockDiscussions())
    return
  }

  try {
    const [redditResult, reviews] = await Promise.all([
      hasReddit ? searchRedditDiscussions(title, author) : Promise.resolve({ quotes: [], chapterThreads: [] }),
      hasHardcover ? fetchHardcoverReviews(title, author) : Promise.resolve([]),
    ])

    const payload: DiscussionsResponse = {
      quotes: redditResult.quotes,
      chapterThreads: redditResult.chapterThreads,
      reviews,
      mock: false,
    }

    // Cache per-book for a week at Vercel's edge, so a personal reader
    // stays well within Reddit's free-tier rate limit without needing a
    // separate cache store.
    res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400')
    res.status(200).json(payload)
  } catch (err) {
    console.error('discussions handler failed', err)
    res.setHeader('Cache-Control', 'public, s-maxage=300')
    res.status(200).json({ quotes: [], chapterThreads: [], reviews: [], mock: false } satisfies DiscussionsResponse)
  }
}
