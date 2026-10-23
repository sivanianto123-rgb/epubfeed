import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StoredBook } from '../types'
import { updateProgress, toggleHighlight, saveSummary } from '../lib/library'
import { buildCumulativeWords } from '../lib/progress'
import { toHandle } from '../lib/format'
import { EMPTY_DISCUSSIONS, buildDiscussionsState, fetchDiscussions, type DiscussionsState } from '../lib/discussions'
import { fetchBookSummary } from '../lib/summary'
import { PostCard } from './PostCard'
import { BackIcon } from './Icons'

interface FeedProps {
  book: StoredBook
  onBack: () => void
}

export function Feed({ book, onBack }: FeedProps) {
  const { meta, posts } = book
  const handle = useMemo(() => toHandle(meta.title), [meta.title])
  const total = posts.length
  const totalChapters = total > 0 ? posts[total - 1].chapterIndex + 1 : 0

  const { cumulative, total: totalWords } = useMemo(() => buildCumulativeWords(posts), [posts])

  const initialChapterIndex = total > 0 ? posts[Math.min(meta.currentIndex, total - 1)].chapterIndex : 0
  const [currentChapterIndex, setCurrentChapterIndex] = useState(initialChapterIndex)
  const [currentIndex, setCurrentIndex] = useState(meta.currentIndex)
  const [highlights, setHighlights] = useState<Set<number>>(() => new Set(book.highlights || []))
  const [discussions, setDiscussions] = useState<DiscussionsState>(EMPTY_DISCUSSIONS)
  const [reachedEnd, setReachedEnd] = useState(false)
  const [summary, setSummary] = useState<string | null>(book.summary ?? null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [recapOpen, setRecapOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const summaryRequestedRef = useRef(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const endMarkerRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)
  const visibleSetRef = useRef<Set<number>>(new Set())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentIndexRef = useRef(meta.currentIndex)
  currentIndexRef.current = currentIndex

  const isLastChapter = totalChapters === 0 || currentChapterIndex >= totalChapters - 1

  const chapterPosts = useMemo(
    () => posts.map((post, i) => ({ post, i })).filter(({ post }) => post.chapterIndex === currentChapterIndex),
    [posts, currentChapterIndex],
  )

  const chapterDiscussion = discussions.chapterDiscussions.get(currentChapterIndex)
  const hasChapterDiscussion = !!chapterDiscussion && (chapterDiscussion.comments.length > 0 || !!chapterDiscussion.thread)

  const handleToggleHighlight = useCallback(
    (index: number) => {
      setHighlights((prev) => {
        const next = new Set(prev)
        if (next.has(index)) next.delete(index)
        else next.add(index)
        return next
      })
      toggleHighlight(meta.id, index)
    },
    [meta.id],
  )

  // Fetch "what other readers think" once per book.
  useEffect(() => {
    let cancelled = false
    fetchDiscussions(meta.title, meta.author).then((data) => {
      if (cancelled) return
      setDiscussions(buildDiscussionsState(posts, data))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id])

  // Detect when the reader has scrolled to the end of the LAST chapter —
  // the true end of the book, not just the end of whichever chapter is
  // currently loaded.
  useEffect(() => {
    if (!isLastChapter) return
    const el = endMarkerRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setReachedEnd(true)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isLastChapter, currentChapterIndex])

  // Reveals the recap panel, generating it (once, lazily) the first time
  // the reader actually asks to see it — never speculatively.
  const handleRecapToggle = useCallback(() => {
    setRecapOpen((v) => !v)
    if (summary || summaryRequestedRef.current) return
    summaryRequestedRef.current = true
    setSummaryLoading(true)
    const fullText = posts
      .filter((p) => p.type === 'text')
      .map((p) => p.text.replace(/[_*]/g, ''))
      .join('\n\n')
    fetchBookSummary(meta.title, meta.author, fullText).then((result) => {
      setSummaryLoading(false)
      if (result) {
        setSummary(result)
        saveSummary(meta.id, result)
      }
    })
  }, [summary, posts, meta.title, meta.author, meta.id])

  // Restore scroll position to the saved post, once, on first load.
  useEffect(() => {
    if (restoredRef.current) return
    if (meta.currentIndex === 0) {
      restoredRef.current = true
      return
    }
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-index="${meta.currentIndex}"]`)
    if (el) {
      el.scrollIntoView({ block: 'start' })
      restoredRef.current = true
    }
  }, [chapterPosts, meta.currentIndex])

  // Track reading progress (topmost visible post in the current chapter)
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.index)
          if (Number.isNaN(idx)) continue
          if (entry.isIntersecting) visibleSetRef.current.add(idx)
          else visibleSetRef.current.delete(idx)
        }
        if (visibleSetRef.current.size > 0) {
          const top = Math.min(...visibleSetRef.current)
          setCurrentIndex(top)
        }
      },
      { root: null, rootMargin: '-56px 0px -70% 0px', threshold: 0 },
    )
    const cards = root.querySelectorAll<HTMLElement>('[data-index]')
    cards.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [chapterPosts])

  // Debounced progress persistence
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      updateProgress(meta.id, currentIndexRef.current)
    }, 600)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [currentIndex, meta.id])

  // Save on unmount (e.g. navigating back) using the ref so this always
  // flushes the latest index, never a value captured at mount time.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      updateProgress(meta.id, currentIndexRef.current)
    }
  }, [meta.id])

  const goToChapter = useCallback((chapterIndex: number) => {
    setCurrentChapterIndex(chapterIndex)
    setCommentsOpen(false)
    visibleSetRef.current = new Set()
    requestAnimationFrame(() => {
      containerRef.current?.scrollTo({ top: 0 })
    })
  }, [])

  const goNextChapter = useCallback(() => {
    if (!isLastChapter) goToChapter(currentChapterIndex + 1)
  }, [isLastChapter, currentChapterIndex, goToChapter])

  const goPrevChapter = useCallback(() => {
    if (currentChapterIndex > 0) goToChapter(currentChapterIndex - 1)
  }, [currentChapterIndex, goToChapter])

  // Keyboard navigation within the current chapter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'j' && e.key !== 'k' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const dir = e.key === 'j' || e.key === 'ArrowDown' ? 1 : -1
      const target = currentIndex + dir
      if (target < 0 || target >= total) return
      if (posts[target].chapterIndex !== currentChapterIndex) return
      const el = containerRef.current?.querySelector<HTMLElement>(`[data-index="${target}"]`)
      if (el) {
        e.preventDefault()
        el.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentIndex, total, posts, currentChapterIndex])

  const progressPct =
    totalWords > 0 && total > 0
      ? Math.min(100, Math.round((cumulative[Math.min(currentIndex, total - 1)] / totalWords) * 100))
      : 0

  const reviewsAvailable = discussions.reviews.length > 0

  return (
    <div className="feed-screen">
      <header className="feed-header">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Back to library">
          <BackIcon />
        </button>
        <div className="feed-header-text">
          <div className="feed-header-title">{meta.title}</div>
          <div className="feed-header-sub">
            Chapter {currentChapterIndex + 1} of {totalChapters} · {progressPct}% read
          </div>
        </div>
      </header>
      <div className="feed-progress-track">
        <div className="feed-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="feed-scroll" ref={containerRef}>
        {currentChapterIndex === 0 && (
          <>
            <div className="frontispiece">
              {meta.coverDataUrl ? (
                <img className="frontispiece-cover" src={meta.coverDataUrl} alt="" />
              ) : (
                <div className="frontispiece-cover-fallback">
                  <span>{meta.title}</span>
                </div>
              )}
              <p className="frontispiece-kicker">Now reading</p>
              <h2 className="frontispiece-title">{meta.title}</h2>
              <p className="frontispiece-author">by {meta.author}</p>
            </div>

            {reviewsAvailable && (
              <div className="reviews-panel reviews-panel--intro">
                <div className="reviews-panel-kicker">What readers say</div>
                <div className="reviews-panel-row">
                  <div className="reviews-panel-title">Reddit on this book{discussions.mock ? ' (demo)' : ''}</div>
                  <button className="reveal-button" type="button" onClick={() => setReviewsOpen((v) => !v)}>
                    {reviewsOpen ? 'Hide reviews' : 'Show reviews'}
                  </button>
                </div>
                {reviewsOpen && (
                  <div className="reviews-panel-body">
                    {discussions.reviews.map((review, i) => (
                      <div key={i} className="review-card">
                        {review.rating != null && (
                          <div className="review-rating">
                            {'★'.repeat(review.rating)}
                            {'☆'.repeat(Math.max(0, 5 - review.rating))}
                          </div>
                        )}
                        <p>{review.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {currentChapterIndex > 0 && (
          <div className="chapter-nav chapter-nav--prev">
            <button className="prev-chapter-button" type="button" onClick={goPrevChapter}>
              ‹ Previous chapter
            </button>
          </div>
        )}

        {chapterPosts.map(({ post, i }, idx) => {
          const next = chapterPosts[idx + 1]?.post
          const threaded = post.type === 'text' && !!next && next.type === 'text'
          return (
            <PostCard
              key={i}
              post={post}
              index={i}
              displayName={meta.author}
              handle={handle}
              avatar={meta.coverDataUrl}
              threaded={threaded}
              highlighted={highlights.has(i)}
              onToggleHighlight={handleToggleHighlight}
            />
          )
        })}

        {hasChapterDiscussion && chapterDiscussion && (
          <div className="chapter-comments">
            <div className="chapter-comments-row">
              <div className="chapter-comments-title">💬 Reader discussion{discussions.mock ? ' (demo)' : ''}</div>
              <button className="reveal-button" type="button" onClick={() => setCommentsOpen((v) => !v)}>
                {commentsOpen ? 'Hide comments' : 'Show comments'}
              </button>
            </div>
            {commentsOpen && (
              <div className="chapter-comments-body">
                {chapterDiscussion.comments.map((comment, ci) => (
                  <a
                    key={ci}
                    className="chapter-comment"
                    href={comment.permalink}
                    target={discussions.mock ? undefined : '_blank'}
                    rel="noreferrer"
                    onClick={discussions.mock ? (e) => e.preventDefault() : undefined}
                  >
                    <span className="chapter-comment-text">“{comment.text}”</span>
                    <span className="chapter-comment-source">
                      u/{comment.author} · r/{comment.subreddit}
                    </span>
                  </a>
                ))}
                {chapterDiscussion.thread && (
                  <a
                    className="chapter-thread-link"
                    href={chapterDiscussion.thread.permalink}
                    target={discussions.mock ? undefined : '_blank'}
                    rel="noreferrer"
                    onClick={discussions.mock ? (e) => e.preventDefault() : undefined}
                  >
                    View the full discussion on r/{chapterDiscussion.thread.subreddit} →
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {!isLastChapter && (
          <div className="chapter-nav chapter-nav--next">
            <button className="next-chapter-button" type="button" onClick={goNextChapter}>
              Next chapter →
            </button>
          </div>
        )}

        {isLastChapter && (
          <div className="feed-end" ref={endMarkerRef}>
            <span className="feed-end-label">— end of book —</span>
            {reachedEnd && (
              <div className="recap-panel">
                <div className="reviews-panel-row">
                  <div className="recap-panel-title">Recap</div>
                  <button className="reveal-button" type="button" onClick={handleRecapToggle}>
                    {recapOpen ? 'Hide recap' : 'Show recap'}
                  </button>
                </div>
                {recapOpen &&
                  (summaryLoading ? (
                    <p className="recap-loading">Putting together a recap…</p>
                  ) : summary ? (
                    <p className="recap-text">{summary}</p>
                  ) : (
                    <p className="recap-fallback">Add an OpenRouter key to get an AI-written recap here.</p>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
