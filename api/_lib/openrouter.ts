const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct:free'
const BLOCK_SIZE = 40000

export interface TopicSection {
  title: string
  /** Character offset into the original (full) text where this section starts. */
  startIndex: number
}

interface RawSection {
  title: string
  startText: string
}

function extractJson(text: string): string {
  // Models sometimes wrap JSON in a markdown code fence — strip it.
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return (match ? match[1] : text).trim()
}

function buildPrompt(block: string): string {
  return `You are splitting a document into topic sections for a reading app.

Given the text below, return a JSON array of section breaks. Each entry has:
- "title": a short (3-8 word) descriptive heading for that section
- "startText": the first 6-10 words of that section, copied EXACTLY from the source text (same punctuation and capitalization), so it can be located by string search

Only include real topic shifts — aim for sections of a few paragraphs to a page each, not one per paragraph. The first section should start at or near the very beginning of the text.

Return ONLY the JSON array, with no other text, no markdown fences, and no explanation.

TEXT:
"""
${block}
"""`
}

async function splitBlock(block: string, apiKey: string, model: string): Promise<RawSection[]> {
  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://epubfeed.vercel.app',
      'X-Title': 'epubfeed',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: buildPrompt(block) }],
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    console.error('OpenRouter error', res.status, await res.text().catch(() => ''))
    return []
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = json.choices?.[0]?.message?.content || ''
  try {
    const parsed = JSON.parse(extractJson(content))
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is RawSection => typeof item?.title === 'string' && typeof item?.startText === 'string',
    )
  } catch (err) {
    console.error('Failed to parse OpenRouter topic-split response', err, content.slice(0, 200))
    return []
  }
}

/**
 * Splits plain text (e.g. from a PDF or a video transcript, which have no
 * built-in chapter structure) into topic sections using a free OpenRouter
 * model. Processes the document in blocks sequentially (both to stay within
 * context and to avoid bursting the free tier's rate limit). Returns []
 * if no OPENROUTER_API_KEY is configured, or if the model call fails —
 * callers should fall back to plain paragraph-based chunking in that case.
 */
export async function splitIntoTopics(text: string): Promise<TopicSection[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || !text.trim()) return []
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL

  const sections: TopicSection[] = []
  for (let offset = 0; offset < text.length; offset += BLOCK_SIZE) {
    const block = text.slice(offset, offset + BLOCK_SIZE)
    const blockSections = await splitBlock(block, apiKey, model)
    for (const s of blockSections) {
      const idx = block.indexOf(s.startText)
      if (idx >= 0) sections.push({ title: s.title, startIndex: offset + idx })
    }
  }

  sections.sort((a, b) => a.startIndex - b.startIndex)
  return sections
}
