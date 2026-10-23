import type { ParsedBook, Post } from '../types'

const WORDS_PER_MINUTE = 200

function wordCount(text: string): number {
  const plain = text.replace(/[_*]/g, '')
  return plain.trim() ? plain.trim().split(/\s+/).length : 0
}

/** One heading post plus one text post per chapter — the whole chapter's
 * body, paragraph breaks intact, under a single author header. */
export function buildPosts(book: ParsedBook): Post[] {
  const posts: Post[] = []

  book.chapters.forEach((chapter, chapterIndex) => {
    posts.push({ type: 'heading', text: chapter.title, chapterIndex, chapterTitle: chapter.title, minutesLeft: 0 })

    const body = chapter.paragraphs
      .filter((p) => !p.heading)
      .map((p) => p.text)
      .join('\n\n')

    if (body.trim()) {
      const minutesLeft = Math.max(1, Math.round(wordCount(body) / WORDS_PER_MINUTE))
      posts.push({ type: 'text', text: body, chapterIndex, chapterTitle: chapter.title, minutesLeft })
    }
  })

  return posts
}
