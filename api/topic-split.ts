import type { VercelRequest, VercelResponse } from '@vercel/node'
import { splitIntoTopics } from './_lib/openrouter.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' })
    return
  }

  const text = typeof req.body?.text === 'string' ? req.body.text : ''
  if (!text.trim()) {
    res.status(400).json({ error: 'Missing required "text" field in request body.' })
    return
  }

  try {
    const sections = await splitIntoTopics(text)
    res.status(200).json({ sections })
  } catch (err) {
    console.error('topic-split handler failed', err)
    res.status(200).json({ sections: [] })
  }
}
