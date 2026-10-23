export interface ChapterParagraph {
  text: string
  heading: boolean
}

export interface ParsedChapter {
  title: string
  paragraphs: ChapterParagraph[]
}

export interface ParsedBook {
  title: string
  author: string
  coverDataUrl: string | null
  chapters: ParsedChapter[]
}

interface BasePost {
  chapterIndex: number
  /** Normalized, display-ready chapter title (e.g. bare "1" becomes "Chapter 1"). */
  chapterTitle: string
  /** Estimated minutes left in this post's chapter, from this post onward. */
  minutesLeft: number
}

export type Post =
  | ({ type: 'text'; text: string } & BasePost)
  | ({ type: 'heading'; text: string } & BasePost)

export interface LibraryEntry {
  id: string
  title: string
  author: string
  coverDataUrl: string | null
  addedAt: number
  totalPosts: number
  currentIndex: number
  /** Word-weighted reading progress, 0-100. More accurate than a post-index ratio. */
  progressPct: number
}

export interface StoredBook {
  meta: LibraryEntry
  posts: Post[]
  /** Indices (into `posts`) the reader has starred. */
  highlights?: number[]
}
