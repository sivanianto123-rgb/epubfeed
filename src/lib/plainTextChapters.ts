import type { ParsedChapter } from '../types'

export interface TopicSection {
  title: string
  startIndex: number
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Fetches AI-derived topic sections for plain text with no built-in
 * chapter structure (PDFs, video transcripts). Returns [] if the backend
 * has no OpenRouter key configured, or on any failure — callers should
 * treat that as "no sections" and fall back to a single chapter. */
export async function fetchTopicSections(text: string): Promise<TopicSection[]> {
  try {
    const res = await fetch('/api/topic-split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { sections?: TopicSection[] }
    return Array.isArray(data.sections) ? data.sections : []
  } catch {
    return []
  }
}

/** Turns plain text into chapters, using AI-derived section breaks when
 * available, or a single chapter (still paragraph-split, so the normal
 * tweet-sized chunker still works) when not. */
export function buildChaptersFromPlainText(
  text: string,
  fallbackTitle: string,
  sections: TopicSection[],
): ParsedChapter[] {
  if (sections.length === 0) {
    return [{ title: fallbackTitle, paragraphs: splitParagraphs(text).map((p) => ({ text: p, heading: false })) }]
  }

  const chapters: ParsedChapter[] = []
  for (let i = 0; i < sections.length; i++) {
    const start = sections[i].startIndex
    const end = i + 1 < sections.length ? sections[i + 1].startIndex : text.length
    const slice = text.slice(start, end)
    const paragraphs = splitParagraphs(slice).map((p) => ({ text: p, heading: false }))
    if (paragraphs.length === 0) continue
    chapters.push({ title: sections[i].title, paragraphs })
  }

  return chapters.length > 0
    ? chapters
    : [{ title: fallbackTitle, paragraphs: splitParagraphs(text).map((p) => ({ text: p, heading: false })) }]
}
