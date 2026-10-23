import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StoredBook } from '../types'
import { updateProgress, toggleHighlight, toggleBookmark, toggleLove } from '../lib/library'
import { buildCumulativeWords } from '../lib/progress'
import { toHandle } from '../lib/format'
import {
  EMPTY_DISCUSSIONS,
  buildDiscussionsState,
  fetchDiscussions,
  redditSearchUrl,
  type DiscussionsState,
} from '../lib/discussions'
import { PostCard } from './PostCard'
import { BackIcon, BookmarkIcon, ExternalLinkIcon, HeartIcon, TeacupDoodle, FeatherDoodle, MoonDoodle } from './Icons'

interface FeedProps {
  book: StoredBook
  onBack: () => void
}

const BATCH_SIZE = 24

const CLOSING_NOTES = [
  { Doodle: TeacupDoodle, note: 'Pause. Sip your tea. Let that line settle.' },
  { Doodle: FeatherDoodle, note: 'One good line is worth rereading twice.' },
  { Doodle: MoonDoodle, note: 'Close your eyes for a second. Picture the scene.' },
]

export function Feed({ book, onBack }: FeedProps) {
  const { meta, posts } = book
  const handle = useMemo(() => toHandle(meta.title), [meta.title])
  const total = posts.length
  const totalChapters = total > 0 ? posts[total - 1].chapterIndex + 1 : 0

  const { cumulative, total: totalWords } = useMemo(() => buildCumulativeWords(posts), [posts])

  const [activeTab, setActiveTab] = useState<'feed' | 'bookmarks'>('feed')
  const [visibleCount, setVisibleCount] = useState(Math.min(total, Math.max(meta.currentIndex + BATCH_SIZE, BATCH_SIZE)))
  const [currentIndex, setCurrentIndex] = useState(meta.currentIndex)
  const [highlights, setHighlights] = useState<Set<number>>(() => new Set(book.highlights || []))
  const [bookmarks, setBookmarks] = useState<Set<number>>(() => new Set(book.bookmarks || []))
  const [loves, setLoves] = useState<Set<number>>(() => new Set(book.loves || []))
  const [discussions, setDiscussions] = useState<DiscussionsState>(EMPTY_DISCUSSIONS)
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState<Set<number>>(new Set())

  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)
  const visibleSetRef = useRef<Set<number>>(new Set())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentIndexRef = useRef(meta.currentIndex)
  currentIndexRef.current = currentIndex

  const visiblePosts = posts.slice(0, visibleCount)

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

  const handleToggleBookmark = useCallback(
    (chapterIndex: number) => {
      setBookmarks((prev) => {
        const next = new Set(prev)
        if (next.has(chapterIndex)) next.delete(chapterIndex)
        else next.add(chapterIndex)
        return next
      })
      toggleBookmark(meta.id, chapterIndex)
    },
    [meta.id],
  )

  const handleToggleLove = useCallback(
    (chapterIndex: number) => {
      setLoves((prev) => {
        const next = new Set(prev)
        if (next.has(chapterIndex)) next.delete(chapterIndex)
        else next.add(chapterIndex)
        return next
      })
      toggleLove(meta.id, chapterIndex)
    },
    [meta.id],
  )

  const handleToggleComments = useCallback((chapterIndex: number) => {
    setCommentsOpen((prev) => {
      const next = new Set(prev)
      if (next.has(chapterIndex)) next.delete(chapterIndex)
      else next.add(chapterIndex)
      return next
    })
  }, [])

  // Fetch "what other readers think" once per book and group it by chapter.
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

  // Infinite-load sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((v) => Math.min(total, v + BATCH_SIZE))
        }
      },
      { rootMargin: '1200px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [total])

  // Restore scroll position once the saved index is rendered
  useEffect(() => {
    if (restoredRef.current) return
    if (meta.currentIndex === 0) {
      restoredRef.current = true
      return
    }
    if (meta.currentIndex >= visibleCount) return
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-index="${meta.currentIndex}"]`)
    if (el) {
      el.scrollIntoView({ block: 'start' })
      restoredRef.current = true
    }
  }, [visibleCount, meta.currentIndex])

  // Track reading progress (topmost visible post)
  useEffect(() => {
    if (activeTab !== 'feed') return
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
  }, [visibleCount, activeTab])

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

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (activeTab !== 'feed') return
      if (e.key !== 'j' && e.key !== 'k' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const dir = e.key === 'j' || e.key === 'ArrowDown' ? 1 : -1
      const target = currentIndex + dir
      if (target < 0 || target >= total) return
      const el = containerRef.current?.querySelector<HTMLElement>(`[data-index="${target}"]`)
      if (el) {
        e.preventDefault()
        el.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentIndex, total, activeTab])

  const jumpToChapter = useCallback(
    (chapterIndex: number) => {
      const targetGlobalIndex = posts.findIndex((p) => p.chapterIndex === chapterIndex)
      if (targetGlobalIndex < 0) return
      setActiveTab('feed')
      setVisibleCount((v) => Math.max(v, targetGlobalIndex + BATCH_SIZE))
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = containerRef.current?.querySelector<HTMLElement>(`[data-index="${targetGlobalIndex}"]`)
          el?.scrollIntoView({ block: 'start' })
        })
      })
    },
    [posts],
  )

  const progressPct =
    totalWords > 0 && total > 0
      ? Math.min(100, Math.round((cumulative[Math.min(currentIndex, total - 1)] / totalWords) * 100))
      : 0

  const bookmarkedChapters = useMemo(() => Array.from(bookmarks).sort((a, b) => a - b), [bookmarks])

  return (
    <div className="feed-screen">
      <header className="feed-header">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Back to library">
          <BackIcon />
        </button>
        <div className="feed-header-text">
          <div className="feed-header-title">{meta.title}</div>
          <div className="feed-header-sub">
            {totalChapters} chapters · {progressPct}% read
          </div>
        </div>
      </header>
      <div className="feed-progress-track">
        <div className="feed-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="feed-tabs">
        <button
          className={`feed-tab ${activeTab === 'feed' ? 'is-active' : ''}`}
          type="button"
          onClick={() => setActiveTab('feed')}
        >
          For you
        </button>
        <button
          className={`feed-tab ${activeTab === 'bookmarks' ? 'is-active' : ''}`}
          type="button"
          onClick={() => setActiveTab('bookmarks')}
        >
          Bookmarks ({bookmarkedChapters.length})
        </button>
      </div>

      {activeTab === 'bookmarks' ? (
        <div className="bookmarks-screen">
          {bookmarkedChapters.length === 0 ? (
            <p className="bookmarks-empty">Save chapters to find them here.</p>
          ) : (
            bookmarkedChapters.map((chapterIndex) => {
              const chapterPost = posts.find((p) => p.chapterIndex === chapterIndex)
              return (
                <button
                  key={chapterIndex}
                  className="bookmark-card"
                  type="button"
                  onClick={() => jumpToChapter(chapterIndex)}
                >
                  <span className="bookmark-card-title">{chapterPost?.chapterTitle || `Chapter ${chapterIndex + 1}`}</span>
                  <span className="bookmark-card-go">Go to chapter →</span>
                </button>
              )
            })
          )}
        </div>
      ) : (
        <div className="feed-scroll" ref={containerRef}>
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

          <div className="reviews-panel reviews-panel--intro">
            <div className="reviews-panel-kicker">What readers say</div>
            <div className="reviews-panel-row">
              <div className="reviews-panel-title">Reddit on this book</div>
              <button className="reveal-button" type="button" onClick={() => setReviewsOpen((v) => !v)}>
                {reviewsOpen ? 'Hide reviews' : 'Show reviews'}
              </button>
            </div>
            {reviewsOpen && (
              <div className="reviews-panel-body">
                {discussions.reviews.length > 0 ? (
                  discussions.reviews.map((review, i) => (
                    <div key={i} className="review-card">
                      {review.rating != null && (
                        <div className="review-rating">
                          {'★'.repeat(review.rating)}
                          {'☆'.repeat(Math.max(0, 5 - review.rating))}
                        </div>
                      )}
                      <p>{review.text}</p>
                    </div>
                  ))
                ) : (
                  <>
                    <p className="discussion-empty">No reviews came through here yet.</p>
                    <a className="discussion-link" href={redditSearchUrl(meta.title, meta.author)} target="_blank" rel="noreferrer">
                      See all on Reddit
                      <ExternalLinkIcon size={13} />
                    </a>
                  </>
                )}
              </div>
            )}
          </div>

          {visiblePosts.map((post, i) => {
            const next = posts[i + 1]
            const threaded = post.type === 'text' && !!next && next.type === 'text' && next.chapterIndex === post.chapterIndex
            const isChapterEnd = !next || next.chapterIndex !== post.chapterIndex
            const discussion = isChapterEnd ? discussions.chapterDiscussions.get(post.chapterIndex) : undefined
            const chapterIndex = post.chapterIndex
            const isBookmarked = bookmarks.has(chapterIndex)
            const isLoved = loves.has(chapterIndex)
            const { Doodle, note } = CLOSING_NOTES[chapterIndex % CLOSING_NOTES.length]
            return (
              <Fragment key={i}>
                <PostCard
                  post={post}
                  index={i}
                  displayName={meta.author}
                  handle={handle}
                  avatar={meta.coverDataUrl}
                  threaded={threaded}
                  highlighted={highlights.has(i)}
                  onToggleHighlight={handleToggleHighlight}
                />
                {isChapterEnd && (
                  <div className="chapter-closing">
                    <Doodle className="chapter-closing-doodle" />
                    <p className="chapter-closing-note">{note}</p>
                  </div>
                )}
                {isChapterEnd && (
                  <div className="chapter-actions-row">
                    <button
                      className={`chapter-action ${isLoved ? 'is-active' : ''}`}
                      type="button"
                      onClick={() => handleToggleLove(chapterIndex)}
                    >
                      <HeartIcon size={18} filled={isLoved} />
                      <span>Love</span>
                    </button>
                    <button
                      className={`chapter-action ${isBookmarked ? 'is-active' : ''}`}
                      type="button"
                      onClick={() => handleToggleBookmark(chapterIndex)}
                    >
                      <BookmarkIcon size={18} filled={isBookmarked} />
                      <span>Save</span>
                    </button>
                  </div>
                )}
                {isChapterEnd && (
                  <div className="chapter-comments">
                    <div className="reviews-panel-kicker">Comments</div>
                    <div className="reviews-panel-row">
                      <div className="reviews-panel-title">Reddit readers on this chapter</div>
                      <button className="reveal-button" type="button" onClick={() => handleToggleComments(chapterIndex)}>
                        {commentsOpen.has(chapterIndex) ? 'Hide comments' : 'Show comments'}
                      </button>
                    </div>
                    {commentsOpen.has(chapterIndex) &&
                      (discussion && (discussion.comments.length > 0 || discussion.thread) ? (
                        <div className="reviews-panel-body">
                          {discussion.comments.map((comment, ci) => (
                            <a key={ci} className="chapter-comment" href={comment.permalink} target="_blank" rel="noreferrer">
                              <span className="chapter-comment-text">“{comment.text}”</span>
                              <span className="chapter-comment-source">
                                u/{comment.author} · r/{comment.subreddit}
                              </span>
                            </a>
                          ))}
                          {discussion.thread && (
                            <a className="chapter-thread-link" href={discussion.thread.permalink} target="_blank" rel="noreferrer">
                              View the full discussion on r/{discussion.thread.subreddit} →
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="reviews-panel-body">
                          <p className="discussion-empty">No Reddit threads came through here yet.</p>
                          <a
                            className="discussion-link"
                            href={redditSearchUrl(meta.title, meta.author, post.chapterTitle)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            See all on Reddit
                            <ExternalLinkIcon size={13} />
                          </a>
                        </div>
                      ))}
                  </div>
                )}
              </Fragment>
            )
          })}
          {visibleCount < total && <div ref={sentinelRef} className="feed-sentinel" />}
          {visibleCount >= total && (
            <div className="feed-end">
              <span>— end of book —</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
