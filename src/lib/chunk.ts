import type { ParsedBook, Post } from '../types'

const MAX_LEN = 280
const MIN_LEN = 60
const WORDS_PER_MINUTE = 200

/** Splits text into sentence-like tokens, but never inside an open quote —
 * so a line of dialogue is never torn apart mid-quote. */
function tokenizeSentences(text: string): string[] {
  const tokens: string[] = []
  let current = ''
  let curlyDepth = 0
  let straightOpen = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    current += ch
    if (ch === '“') curlyDepth++
    else if (ch === '”') curlyDepth = Math.max(0, curlyDepth - 1)
    else if (ch === '"') straightOpen = !straightOpen

    const insideQuote = curlyDepth > 0 || straightOpen
    if (!insideQuote && /[.!?]/.test(ch)) {
      let j = i + 1
      while (j < text.length && /[\s"”)\]]/.test(text[j])) {
        if (text[j] === '”') curlyDepth = Math.max(0, curlyDepth - 1)
        if (text[j] === '"') straightOpen = !straightOpen
        current += text[j]
        j++
      }
      i = j - 1
      tokens.push(current)
      current = ''
    }
  }
  if (current.trim()) tokens.push(current)
  return tokens.length ? tokens : [text]
}

/** Greedily packs tokens up to maxLen. A single token longer than maxLen
 * (e.g. a long quoted line) becomes its own chunk rather than being torn
 * apart — the UI truncates long posts with "Show more" instead. */
function packTokens(tokens: string[], maxLen: number): string[] {
  const chunks: string[] = []
  let current = ''
  for (const token of tokens) {
    if (!current) {
      current = token
    } else if ((current + token).length <= maxLen) {
      current += token
    } else {
      chunks.push(current.trim())
      current = token
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

function splitLongParagraph(text: string): string[] {
  return packTokens(tokenizeSentences(text), MAX_LEN)
}

function wordCount(text: string): number {
  const plain = text.replace(/[_*]/g, '')
  return plain.trim() ? plain.trim().split(/\s+/).length : 0
}

/** Fills in `minutesLeft` for every post: words remaining in that post's
 * chapter, from the post onward, at ~200wpm. Mutates in place. */
function attachReadingTime(posts: Post[]): void {
  let i = posts.length - 1
  while (i >= 0) {
    const chapterIndex = posts[i].chapterIndex
    let j = i
    while (j >= 0 && posts[j].chapterIndex === chapterIndex) j--
    let running = 0
    for (let k = i; k > j; k--) {
      if (posts[k].type === 'text') running += wordCount(posts[k].text)
      posts[k].minutesLeft = Math.max(1, Math.round(running / WORDS_PER_MINUTE))
    }
    i = j
  }
}

export function buildPosts(book: ParsedBook): Post[] {
  const posts: Post[] = []
  let buffer: string[] = []
  let bufferLen = 0

  const flush = (chapterIndex: number, chapterTitle: string) => {
    if (bufferLen > 0) {
      posts.push({ type: 'text', text: buffer.join('\n\n'), chapterIndex, chapterTitle, minutesLeft: 0 })
      buffer = []
      bufferLen = 0
    }
  }

  book.chapters.forEach((chapter, chapterIndex) => {
    // One clean divider per chapter (using the already-normalized title),
    // instead of turning every heading-tagged paragraph into its own post.
    posts.push({ type: 'heading', text: chapter.title, chapterIndex, chapterTitle: chapter.title, minutesLeft: 0 })

    chapter.paragraphs.forEach((para) => {
      if (para.heading) return

      if (para.text.length > MAX_LEN) {
        flush(chapterIndex, chapter.title)
        for (const chunk of splitLongParagraph(para.text)) {
          posts.push({ type: 'text', text: chunk, chapterIndex, chapterTitle: chapter.title, minutesLeft: 0 })
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

  attachReadingTime(posts)
  return posts
}
