const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct:free'
const SAMPLE_CHARS = 6000

/** Free-tier models have limited context, and a full novel won't fit
 * anyway within a serverless function's time limit. Sampling the opening
 * and closing portions (rather than summarizing block-by-block) keeps
 * this a single fast request while still covering setup and resolution. */
function sample(text: string): string {
  if (text.length <= SAMPLE_CHARS * 2) return text
  return `${text.slice(0, SAMPLE_CHARS)}\n\n[...]\n\n${text.slice(-SAMPLE_CHARS)}`
}

function buildPrompt(title: string, author: string, excerpt: string): string {
  const byline = author ? ` by ${author}` : ''
  return `Write a short recap of the book "${title}"${byline} for a reader who just finished it, based on the excerpt below (the opening and closing portions of the full text). Cover the main arc and how things resolved, in 4-6 sentences of plain prose. No headings, no spoiler warnings, no preamble — just the recap itself.

EXCERPT:
"""
${excerpt}
"""`
}

function buildChapterPrompt(bookTitle: string, chapterTitle: string, excerpt: string): string {
  return `Write a short recap of what happens in "${chapterTitle}", a chapter from the book "${bookTitle}", based on the excerpt below. 2-4 sentences of plain prose. No headings, no spoiler warnings, no preamble — just the recap of this chapter.

EXCERPT:
"""
${excerpt}
"""`
}

async function callOpenRouter(apiKey: string, model: string, prompt: string): Promise<string | null> {
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
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    }),
  })

  if (!res.ok) {
    console.error('OpenRouter summarize error', res.status, await res.text().catch(() => ''))
    return null
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = json.choices?.[0]?.message?.content?.trim() || ''
  return content || null
}

/**
 * Generates a short end-of-book recap via a free OpenRouter model. Returns
 * null if no OPENROUTER_API_KEY is configured or the request fails —
 * callers should fall back to not showing a recap in that case.
 */
export async function summarizeBook(title: string, author: string, fullText: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || !fullText.trim()) return null
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL
  return callOpenRouter(apiKey, model, buildPrompt(title, author, sample(fullText)))
}

/**
 * Generates a short recap of a single chapter, lazily — only called once a
 * reader actually opens that chapter's recap. Returns null if no
 * OPENROUTER_API_KEY is configured or the request fails.
 */
export async function summarizeChapter(
  bookTitle: string,
  chapterTitle: string,
  chapterText: string,
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || !chapterText.trim()) return null
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL
  return callOpenRouter(apiKey, model, buildChapterPrompt(bookTitle, chapterTitle, sample(chapterText)))
}
