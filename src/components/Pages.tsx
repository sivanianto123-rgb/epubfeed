import type { ReactNode } from 'react'
import { BackIcon } from './Icons'

function StaticPage({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="static-page">
      <header className="static-page-header">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Back to home">
          <BackIcon />
        </button>
        <span className="static-page-title">{title}</span>
      </header>
      <div className="static-page-body">{children}</div>
    </div>
  )
}

export function AboutPage({ onBack }: { onBack: () => void }) {
  return (
    <StaticPage title="About" onBack={onBack}>
      <p>
        Bookfeed turns whatever you're reading or watching into a calm, scrollable feed — one passage
        at a time, instead of a wall of text or a video you have to sit through.
      </p>
      <p>
        Everything runs client-side wherever possible. Books and documents are parsed in your browser
        and stored locally on your device — nothing is uploaded to a server just to read it. The one
        exception is topic-splitting for content without built-in chapters (PDFs, video transcripts),
        which sends the extracted text to an AI model to find natural section breaks.
      </p>
      <p>
        It's a small, independent project — built to make reading feel a little less like a chore and
        a little more like scrolling, minus the doomscroll part.
      </p>
    </StaticPage>
  )
}

export function FormatsPage({ onBack }: { onBack: () => void }) {
  return (
    <StaticPage title="Formats" onBack={onBack}>
      <div className="format-entry">
        <h3>EPUB</h3>
        <p>
          Parsed directly from the book's own chapter structure. No AI needed — the table of contents
          does the work.
        </p>
      </div>
      <div className="format-entry">
        <h3>PDF</h3>
        <p>
          Text is extracted page by page. Since PDFs don't have a standard chapter format, an AI model
          finds natural topic breaks in the text (when configured) — otherwise it reads as one
          continuous feed. Scanned PDFs without a text layer aren't supported.
        </p>
      </div>
      <div className="format-entry">
        <h3>Word (.docx)</h3>
        <p>Same as PDF: the raw text is extracted, then split into topic sections the same way.</p>
      </div>
      <div className="format-entry">
        <h3>YouTube</h3>
        <p>
          Works for videos that have captions (auto-generated or uploaded). The transcript is fetched
          and split into topics. Videos without any captions available can't be read this way.
        </p>
      </div>
    </StaticPage>
  )
}

export function FaqPage({ onBack }: { onBack: () => void }) {
  return (
    <StaticPage title="FAQ" onBack={onBack}>
      <div className="format-entry">
        <h3>Is my data uploaded anywhere?</h3>
        <p>
          No, not to read a book. Files are parsed in your browser and stored locally. The only thing
          that leaves your device is the plain text of a PDF/DOCX/video transcript, sent to an AI
          model purely to find topic breaks — and only when that's configured.
        </p>
      </div>
      <div className="format-entry">
        <h3>How accurate is the chapter/topic splitting?</h3>
        <p>
          For EPUBs, it's exact — it uses the book's real structure. For PDFs, DOCX, and video
          transcripts, it's AI-generated and won't always land perfectly on natural breaks.
        </p>
      </div>
      <div className="format-entry">
        <h3>Why didn't my YouTube video work?</h3>
        <p>Most likely it has no captions available. This only works for videos with a transcript.</p>
      </div>
      <div className="format-entry">
        <h3>Is this free?</h3>
        <p>
          The reader itself, yes — entirely. The AI topic-splitting feature depends on which model is
          configured; some are free-tier, some aren't, depending on setup.
        </p>
      </div>
    </StaticPage>
  )
}
