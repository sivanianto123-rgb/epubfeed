import type { DiscussionsResponse } from './types.js'

/**
 * Returned when no Reddit/Hardcover credentials are configured, so the
 * frontend has something to render and test against before real keys
 * exist. The frontend recognizes `mock: true` and synthesizes demo cards
 * from the actual loaded book's text instead of using these quotes
 * literally (which wouldn't match any real book).
 */
export function mockDiscussions(): DiscussionsResponse {
  return { quotes: [], chapterThreads: [], reviews: [], mock: true }
}
