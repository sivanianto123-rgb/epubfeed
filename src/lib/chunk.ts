import type { ParsedBook, Post } from '../types'

const MAX_LEN = 320
const MIN_LEN = 60

function splitLongParagraph(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [text]
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (current && (current + sentence).length > MAX_LEN) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.length ? chunks : [text]
}

export function buildPosts(book: ParsedBook): Post[] {
  const posts: Post[] = []
  let buffer: string[] = []
  let bufferLen = 0

  const flush = (chapterIndex: number, chapterTitle: string) => {
    if (bufferLen > 0) {
      posts.push({ type: 'text', text: buffer.join('\n\n'), chapterIndex, chapterTitle })
      buffer = []
      bufferLen = 0
    }
  }

  book.chapters.forEach((chapter, chapterIndex) => {
    chapter.paragraphs.forEach((para) => {
      if (para.heading) {
        flush(chapterIndex, chapter.title)
        posts.push({ type: 'heading', text: para.text, chapterIndex, chapterTitle: chapter.title })
        return
      }
      if (para.text.length > MAX_LEN) {
        flush(chapterIndex, chapter.title)
        for (const chunk of splitLongParagraph(para.text)) {
          posts.push({ type: 'text', text: chunk, chapterIndex, chapterTitle: chapter.title })
        }
        return
      }
      if (bufferLen + para.text.length > MAX_LEN) {
        flush(chapterIndex, chapter.title)
      }
      buffer.push(para.text)
      bufferLen += para.text.length
      if (bufferLen >= MIN_LEN) {
        flush(chapterIndex, chapter.title)
      }
    })
    flush(chapterIndex, chapter.title)
  })

  return posts
}
