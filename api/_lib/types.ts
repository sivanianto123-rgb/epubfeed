export interface PassageQuote {
  text: string
  permalink: string
  subreddit: string
  author: string
}

export interface ChapterThreadInfo {
  title: string
  permalink: string
  subreddit: string
  /** 1-based: the last chapter number this thread's discussion covers. */
  throughChapter: number
}

export interface BookReview {
  text: string
  rating: number | null
  permalink: string | null
}

export interface DiscussionsResponse {
  quotes: PassageQuote[]
  chapterThreads: ChapterThreadInfo[]
  reviews: BookReview[]
  mock: boolean
}
