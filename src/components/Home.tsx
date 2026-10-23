import { useCallback, useEffect, useRef, useState } from 'react'
import type { LibraryEntry } from '../types'
import { parseEpub } from '../lib/epubParser'
import { buildPosts } from '../lib/chunk'
import { addBook, getLibrary, removeBook } from '../lib/library'
import { toHandle } from '../lib/format'
import { BookIcon, TrashIcon, UploadIcon } from './Icons'

interface HomeProps {
  onOpenBook: (id: string) => void
}

export function Home({ onOpenBook }: HomeProps) {
  const [library, setLibrary] = useState<LibraryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    setLibrary(await getLibrary())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.epub')) {
        setError('That doesn’t look like an .epub file.')
        return
      }
      setLoading(true)
      setError(null)
      try {
        const parsed = await parseEpub(file)
        const posts = buildPosts(parsed)
        const id = crypto.randomUUID()
        await addBook(
          {
            id,
            title: parsed.title,
            author: parsed.author,
            coverDataUrl: parsed.coverDataUrl,
            addedAt: Date.now(),
            totalPosts: posts.length,
          },
          posts,
        )
        await refresh()
        onOpenBook(id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not read that EPUB.')
      } finally {
        setLoading(false)
      }
    },
    [onOpenBook, refresh],
  )

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      await removeBook(id)
      await refresh()
    },
    [refresh],
  )

  return (
    <div className="home-screen">
      <header className="home-header">
        <span className="home-logo">epubfeed</span>
      </header>

      <div
        className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files?.[0]
          if (file) handleFile(file)
        }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <UploadIcon size={28} />
        <div className="drop-zone-text">
          <strong>{loading ? 'Reading your book…' : 'Drop an .epub here'}</strong>
          <span>or click to choose a file</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".epub,application/epub+zip"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {error && <div className="home-error">{error}</div>}

      <div className="library-list">
        {library.length === 0 && !loading && (
          <div className="library-empty">
            <BookIcon size={32} className="library-empty-icon" />
            <p>Your feed is empty. Upload a book to start scrolling.</p>
          </div>
        )}
        {library.map((entry) => {
          const pct = entry.totalPosts > 0 ? Math.round(((entry.currentIndex + 1) / entry.totalPosts) * 100) : 0
          return (
            <div key={entry.id} className="library-card" onClick={() => onOpenBook(entry.id)}>
              <div className="library-cover">
                {entry.coverDataUrl ? (
                  <img src={entry.coverDataUrl} alt="" />
                ) : (
                  <BookIcon size={24} />
                )}
              </div>
              <div className="library-info">
                <div className="library-title">{entry.title}</div>
                <div className="library-sub">{toHandle(entry.author)}</div>
                <div className="library-progress-track">
                  <div className="library-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="library-progress-label">
                  {entry.currentIndex > 0 ? `${pct}% read` : 'Not started'}
                </div>
              </div>
              <button
                className="library-delete"
                type="button"
                aria-label={`Remove ${entry.title}`}
                onClick={(e) => handleDelete(entry.id, e)}
              >
                <TrashIcon size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
