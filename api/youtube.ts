import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchYoutubeTranscript } from './_lib/youtube'

// Best-effort: raises the platform's execution limit on plans that allow it,
// so our own internal fetch timeouts (which total well under 10s) are the
// ones that decide how this function ends, not Vercel's default Hobby cap.
export const maxDuration = 30

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
