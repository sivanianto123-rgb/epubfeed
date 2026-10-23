import { useEffect, useMemo, useRef, useState } from 'react'
import type { StoredBook } from '../types'
import { updateProgress } from '../lib/library'
import { toHandle } from '../lib/format'
import { PostCard } from './PostCard'
import { BackIcon } from './Icons'

interface FeedProps {
  book: StoredBook
  onBack: () => void
}

const BATCH_SIZE = 24

export function Feed({ book, onBack }: FeedProps) {
  const { meta, posts } = book
  const handle = useMemo(() => toHandle(meta.author), [meta.author])
  const total = posts.length

  const [visibleCount, setVisibleCount] = useState(Math.min(total, Math.max(meta.currentIndex + BATCH_SIZE, BATCH_SIZE)))
  const [currentIndex, setCurrentIndex] = useState(meta.currentIndex)

  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)
  const visibleSetRef = useRef<Set<number>>(new Set())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentIndexRef = useRef(meta.currentIndex)
  currentIndexRef.current = currentIndex

  const visiblePosts = posts.slice(0, visibleCount)

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

  const progressPct = total > 0 ? Math.min(100, Math.round(((currentIndex + 1) / total) * 100)) : 0

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
        {visiblePosts.map((post, i) => (
          <PostCard
            key={i}
            post={post}
            index={i}
            displayName={meta.title}
            handle={handle}
            avatar={meta.coverDataUrl}
          />
        ))}
        {visibleCount < total && <div ref={sentinelRef} className="feed-sentinel" />}
        {visibleCount >= total && <div className="feed-end">— end of book —</div>}
      </div>
    </div>
  )
}
