import { useCallback, useEffect, useRef, useState } from 'react'
import type { LibraryEntry } from '../types'
import { parseEpub } from '../lib/epubParser'
import { buildPosts } from '../lib/chunk'
import { addBook, getLibrary, removeBook } from '../lib/library'
import { toHandle } from '../lib/format'
import { BookIcon, LinkIcon, TrashIcon, UploadIcon } from './Icons'
import { DoodleStrip } from './Doodles'

interface HomeProps {
  onOpenBook: (id: string) => void
}

export function Home({ onOpenBook }: HomeProps) {
  const [library, setLibrary] = useState<LibraryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [url, setUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    setLibrary(await getLibrary())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const ingest = useCallback(
    async (source: File | ArrayBuffer) => {
      setLoading(true)
      setError(null)
      try {
        const parsed = await parseEpub(source)
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

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.epub')) {
        setError('That doesn’t look like an .epub file.')
        return
      }
      ingest(file)
    },
    [ingest],
  )

  const handleUrlSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = url.trim()
      if (!trimmed) return
      let parsedUrl: URL
      try {
        parsedUrl = new URL(trimmed)
      } catch {
        setError('That doesn’t look like a valid URL.')
        return
      }
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        setError('Only http(s) links are supported.')
        return
      }

      setLoading(true)
      setError(null)
      try {
        const res = await fetch(parsedUrl.toString())
        if (!res.ok) {
          throw new Error(`The server responded with ${res.status} ${res.statusText}.`)
        }
        const buffer = await res.arrayBuffer()
        setUrl('')
        await ingest(buffer)
      } catch (e) {
        if (e instanceof TypeError) {
          setError(
            'Could not fetch that URL — the site may not allow cross-origin downloads (CORS), or the link may be unreachable.',
          )
        } else {
          setError(e instanceof Error ? e.message : 'Could not load that URL.')
        }
        setLoading(false)
      }
    },
    [url, ingest],
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
      <header className="home-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <BookIcon size={20} className="home-logo-icon" />
        <span className="home-logo">epubfeed</span>
        <span className="home-header-eyebrow">Your quiet corner</span>
      </header>

      <div className="hero">
        <p className="hero-kicker">One book. A little escape.</p>
        <h1 className="hero-title">epubfeed</h1>
        <p className="hero-sub">
          Lose yourself in a good book.
          <br />
          One scroll at a time.
        </p>

        <button
          type="button"
          className="hero-cta"
          disabled={loading}
          onClick={() => fileInputRef.current?.click()}
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
          data-dragging={dragging || undefined}
        >
          <UploadIcon size={18} />
          {loading ? 'Opening…' : 'Open your EPUB'}
        </button>
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

        <form className="url-form" onSubmit={handleUrlSubmit}>
          <LinkIcon size={16} className="url-form-icon" />
          <input
            type="text"
            inputMode="url"
            placeholder="…or paste a direct link to an .epub"
            value={url}
            disabled={loading}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button type="submit" disabled={loading || !url.trim()}>
            Load
          </button>
        </form>

        {error && (
          <p role="alert" className="hero-error">
            {error}
          </p>
        )}

        <DoodleStrip />
      </div>

      {library.length > 0 && <p className="library-section-label">Your shelf</p>}

      <div className="library-list">
        {library.length === 0 && !loading && (
          <div className="library-empty">
            <BookIcon size={32} className="library-empty-icon" />
            <p>Nothing here yet — open a book above to begin.</p>
          </div>
        )}
        {library.map((entry) => {
          const pct = entry.progressPct
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

      <footer className="home-footer">
        <span>A space between you and the story.</span>
        <BookIcon size={18} />
      </footer>
    </div>
  )
}
