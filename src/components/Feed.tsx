import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const BATCH_SIZE = 24

export function Feed({ book, onBack }: FeedProps) {
  const { meta, posts } = book
  const handle = useMemo(() => toHandle(meta.title), [meta.title])
  const total = posts.length

  const { cumulative, total: totalWords } = useMemo(() => buildCumulativeWords(posts), [posts])

  const [visibleCount, setVisibleCount] = useState(Math.min(total, Math.max(meta.currentIndex + BATCH_SIZE, BATCH_SIZE)))
  const [currentIndex, setCurrentIndex] = useState(meta.currentIndex)
  const [highlights, setHighlights] = useState<Set<number>>(() => new Set(book.highlights || []))
  const [discussions, setDiscussions] = useState<DiscussionsState>(EMPTY_DISCUSSIONS)
  const [reachedEnd, setReachedEnd] = useState(false)
  const [summary, setSummary] = useState<string | null>(book.summary ?? null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const summaryRequestedRef = useRef(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const endMarkerRef = useRef<HTMLDivElement>(null)
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

  // Fetch "what other readers think" once per book and match it to passages.
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

  // Detect when the reader has actually scrolled to the very end of the
  // feed (not just the word-progress heuristic, which only tracks the top
  // of the viewport and can't reliably hit 100% right at the tail).
  useEffect(() => {
    if (visibleCount < total) return
    const el = endMarkerRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setReachedEnd(true)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [visibleCount, total])

  // Generate the end-of-book recap once the reader actually finishes —
  // never speculatively, and only once per book (cached on StoredBook).
  useEffect(() => {
    if (!reachedEnd || summary || summaryRequestedRef.current) return
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
  }, [reachedEnd, summary, posts, meta.title, meta.author, meta.id])

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
  }, [visibleCount])

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
  }, [currentIndex, total])

  const progressPct =
    totalWords > 0 && total > 0
      ? Math.min(100, Math.round((cumulative[Math.min(currentIndex, total - 1)] / totalWords) * 100))
      : 0

  return (
    <div className="feed-screen">
      <header className="feed-header">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Back to library">
          <BackIcon />
        </button>
        <div className="feed-header-text">
          <div className="feed-header-title">{meta.title}</div>
          <div className="feed-header-sub">{progressPct}% read</div>
        </div>
      </header>
      <div className="feed-progress-track">
        <div className="feed-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
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

        {discussions.reviews.length > 0 && (
          <div className="reviews-panel reviews-panel--intro">
            <div className="reviews-panel-title">What readers are saying{discussions.mock ? ' (demo)' : ''}</div>
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

        {visiblePosts.map((post, i) => {
          const next = posts[i + 1]
          const threaded = post.type === 'text' && !!next && next.type === 'text' && next.chapterIndex === post.chapterIndex
          const isChapterEnd = !next || next.chapterIndex !== post.chapterIndex
          const discussion = isChapterEnd ? discussions.chapterDiscussions.get(post.chapterIndex) : undefined
          const hasDiscussion = !!discussion && (discussion.comments.length > 0 || !!discussion.thread)
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
              {hasDiscussion && discussion && (
                <div className="chapter-comments">
                  <div className="chapter-comments-title">
                    💬 Reader discussion{discussions.mock ? ' (demo)' : ''}
                  </div>
                  {discussion.comments.map((comment, ci) => (
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
                  {discussion.thread && (
                    <a
                      className="chapter-thread-link"
                      href={discussion.thread.permalink}
                      target={discussions.mock ? undefined : '_blank'}
                      rel="noreferrer"
                      onClick={discussions.mock ? (e) => e.preventDefault() : undefined}
                    >
                      View the full discussion on r/{discussion.thread.subreddit} →
                    </a>
                  )}
                </div>
              )}
            </Fragment>
          )
        })}
        {visibleCount < total && <div ref={sentinelRef} className="feed-sentinel" />}
        {visibleCount >= total && (
          <div className="feed-end" ref={endMarkerRef}>
            <span className="feed-end-label">— end of book —</span>
            {reachedEnd && (
              <div className="recap-panel">
                <div className="recap-panel-title">Recap</div>
                {summaryLoading ? (
                  <p className="recap-loading">Putting together a recap…</p>
                ) : summary ? (
                  <p className="recap-text">{summary}</p>
                ) : (
                  <p className="recap-fallback">
                    Add an OpenRouter key to get an AI-written recap here.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
