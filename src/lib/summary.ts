/** Fetches an AI-written recap of a single chapter. Returns null if the
 * backend has no OpenRouter key configured, or on any failure — callers
 * should treat that as "no recap available" rather than an error. */
export async function fetchChapterSummary(bookTitle: string, chapterTitle: string, chapterText: string): Promise<string | null> {
  try {
    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: bookTitle, chapterTitle, text: chapterText }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { summary?: string | null }
    return data.summary || null
  } catch {
    return null
  }
}
