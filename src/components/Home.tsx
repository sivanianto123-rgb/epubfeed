import { useCallback, useEffect, useRef, useState } from 'react'
import type { LibraryEntry, ParsedBook } from '../types'
import { parseEpub } from '../lib/epubParser'
import { buildChaptersFromPlainText, fetchTopicSections } from '../lib/plainTextChapters'
import { buildPosts } from '../lib/chunk'
import { addBook, getLibrary, pullCloudLibrary, removeBook } from '../lib/library'
import { toHandle } from '../lib/format'
import { useAuth } from '../hooks/useAuth'
import { AuthButton } from './AuthButton'
import { BookIcon, TrashIcon, UploadIcon, VideoIcon } from './Icons'
import readingStill from '../assets/reading-still.jpg'
import readingDoodles from '../assets/reading-doodles.png'

interface HomeProps {
  onOpenBook: (id: string) => void
  onNavigate: (page: 'formats' | 'about' | 'faq') => void
}

export function Home({ onOpenBook, onNavigate }: HomeProps) {
  const [library, setLibrary] = useState<LibraryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const user = useAuth()

  const refresh = useCallback(async () => {
    setLibrary(await getLibrary())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Once signed in, pull any books this account has synced from another
  // device but doesn't have locally yet.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    pullCloudLibrary(user.uid).then((pulledAny) => {
      if (!cancelled && pulledAny) refresh()
    })
    return () => {
      cancelled = true
    }
  }, [user, refresh])

  const ingestFromParser = useCallback(
    async (parserFn: () => Promise<ParsedBook>, fallbackErrorMsg: string) => {
      setLoading(true)
      setError(null)
      try {
        const parsed = await parserFn()
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
        if (e instanceof TypeError) {
          setError('Could not reach that link — it may block cross-origin requests (CORS), or be unreachable.')
        } else {
          setError(e instanceof Error ? e.message : fallbackErrorMsg)
        }
      } finally {
        setLoading(false)
      }
    },
    [onOpenBook, refresh],
  )

  const ingestPlainText = useCallback(
    async (title: string, author: string, text: string): Promise<ParsedBook> => {
      const sections = await fetchTopicSections(text)
      return { title, author, coverDataUrl: null, chapters: buildChaptersFromPlainText(text, title, sections) }
    },
    [],
  )

  const handleFile = useCallback(
    (file: File) => {
      const name = file.name.toLowerCase()
      if (name.endsWith('.epub')) {
        ingestFromParser(() => parseEpub(file), 'Could not read that EPUB.')
      } else if (name.endsWith('.pdf')) {
        ingestFromParser(async () => {
          const { parsePdf } = await import('../lib/pdfParser')
          const { title, author, text } = await parsePdf(file)
          return ingestPlainText(title, author, text)
        }, 'Could not read that PDF.')
      } else if (name.endsWith('.docx')) {
        ingestFromParser(async () => {
          const { parseDocx } = await import('../lib/docxParser')
          const { title, author, text } = await parseDocx(file)
          return ingestPlainText(title, author, text)
        }, 'Could not read that Word document.')
      } else {
        setError('Unsupported file type — try an .epub, .pdf, or .docx file.')
      }
    },
    [ingestFromParser, ingestPlainText],
  )

  const handleYoutubeSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = youtubeUrl.trim()
      if (!trimmed) return
      await ingestFromParser(async () => {
        const res = await fetch(`/api/youtube?url=${encodeURIComponent(trimmed)}`)
        let data: { title?: string; author?: string; text?: string; error?: string }
        try {
          data = await res.json()
        } catch {
          throw new Error(
            res.ok
              ? 'Got an unexpected response reading that video.'
              : `The server responded with ${res.status} ${res.statusText}.`,
          )
        }
        if (!res.ok || data.error || !data.text) {
          throw new Error(data.error || 'Could not read that video.')
        }
        return ingestPlainText(data.title || 'YouTube video', data.author || 'Unknown Channel', data.text)
      }, 'Could not read that video.')
      setYoutubeUrl('')
    },
    [youtubeUrl, ingestFromParser, ingestPlainText],
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
      <div className="home-hero-wrap">
        <img src={readingStill} alt="" className="home-hero-bg" />
        <div className="home-hero-shade" />

        <header className="home-header">
          <BookIcon size={20} className="home-logo-icon" />
          <span className="home-logo">Bookfeed</span>
          <nav className="home-nav">
            <button type="button" onClick={() => onNavigate('formats')}>
              Formats
            </button>
            <button type="button" onClick={() => onNavigate('about')}>
              About
            </button>
            <button type="button" onClick={() => onNavigate('faq')}>
              FAQ
            </button>
            <AuthButton />
          </nav>
        </header>

        <div className="hero">
          <p className="hero-kicker">Books · PDFs · Docs · Videos</p>
          <h1 className="hero-title">Scroll your reading.</h1>
          <p className="hero-sub">
            Drop in anything you want to read. We turn it into chapters you can lose yourself in.
          </p>

          <div
            className={`hero-dropzone ${dragging ? 'is-dragging' : ''}`}
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
            role="button"
            tabIndex={0}
          >
            <UploadIcon size={20} />
            <div className="hero-dropzone-text">
              <strong>{loading ? 'Reading…' : 'Drop a file or click to choose'}</strong>
              <span>EPUB, PDF or Word (.docx)</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".epub,.pdf,.docx,application/epub+zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />

          <form className="url-form youtube-form" onSubmit={handleYoutubeSubmit}>
            <VideoIcon size={16} className="url-form-icon" />
            <input
              type="text"
              placeholder="Paste a YouTube link"
              value={youtubeUrl}
              disabled={loading}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
            <button type="submit" disabled={loading || !youtubeUrl.trim()}>
              Read it
            </button>
          </form>

          {error && (
            <p role="alert" className="hero-error">
              {error}
            </p>
          )}

          <img src={readingDoodles} alt="" aria-hidden="true" className="doodle-strip" />
        </div>
      </div>

      <div className="home-container">
        {library.length > 0 && <p className="library-section-label">Your library</p>}

        <div className="library-list">
          {library.length === 0 && !loading && (
            <div className="library-empty">
              <BookIcon size={32} className="library-empty-icon" />
              <p>Nothing here yet. Everything you open is saved here on this device.</p>
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
      </div>

      <footer className="home-footer">
        <span>A space between you and the story.</span>
        <BookIcon size={18} />
      </footer>
    </div>
  )
}
