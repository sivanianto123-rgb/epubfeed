import type { VercelRequest, VercelResponse } from '@vercel/node'
import { summarizeBook } from './_lib/summarize'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' })
    return
  }

  const body = (req.body || {}) as { title?: unknown; author?: unknown; text?: unknown }
  const text = typeof body.text === 'string' ? body.text : ''
  if (!text.trim()) {
    res.status(400).json({ error: 'Missing required "text" field in request body.' })
    return
  }
  const title = typeof body.title === 'string' ? body.title : ''
  const author = typeof body.author === 'string' ? body.author : ''

  try {
    const summary = await summarizeBook(title, author, text)
    res.status(200).json({ summary })
  } catch (err) {
    console.error('summarize handler failed', err)
    res.status(200).json({ summary: null })
  }
}
