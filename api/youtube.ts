import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchYoutubeTranscript } from './_lib/youtube.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = typeof req.query.url === 'string' ? req.query.url : ''
  if (!url) {
    res.status(400).json({ error: 'Missing required "url" query parameter.' })
    return
  }

  try {
    const result = await fetchYoutubeTranscript(url)
    res.status(200).json(result)
  } catch (err) {
    res.status(200).json({ error: err instanceof Error ? err.message : 'Could not fetch that video.' })
  }
}
