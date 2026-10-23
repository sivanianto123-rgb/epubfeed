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

export type Post =
  | { type: 'text'; text: string; chapterIndex: number; chapterTitle: string }
  | { type: 'heading'; text: string; chapterIndex: number; chapterTitle: string }

export interface LibraryEntry {
  id: string
  title: string
  author: string
  coverDataUrl: string | null
  addedAt: number
  totalPosts: number
  currentIndex: number
}

export interface StoredBook {
  meta: LibraryEntry
  posts: Post[]
}
