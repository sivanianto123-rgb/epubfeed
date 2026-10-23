/** Fetches an AI-written end-of-book recap. Returns null if the backend
 * has no OpenRouter key configured, or on any failure — callers should
 * treat that as "no recap available" rather than an error. */
export async function fetchBookSummary(title: string, author: string, text: string): Promise<string | null> {
  try {
    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, author, text }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { summary?: string | null }
    return data.summary || null
  } catch {
    return null
  }
}
