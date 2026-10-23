import * as pdfjsLib from 'pdfjs-dist'
// Vite-friendly worker setup: bundles the worker file and gives pdf.js its URL.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export interface PlainTextSource {
  title: string
  author: string
  text: string
}

export async function parsePdf(file: File | ArrayBuffer): Promise<PlainTextSource> {
  const data = file instanceof File ? await file.arrayBuffer() : file
  const doc = await pdfjsLib.getDocument({ data }).promise

  const metadata = await doc.getMetadata().catch(() => null)
  const info = (metadata?.info as { Title?: string; Author?: string } | undefined) || {}
  const fallbackTitle = file instanceof File ? file.name.replace(/\.pdf$/i, '') : 'Untitled PDF'
  const title = info.Title?.trim() || fallbackTitle
  const author = info.Author?.trim() || 'Unknown Author'

  const pageTexts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (pageText) pageTexts.push(pageText)
  }

  if (pageTexts.length === 0) {
    throw new Error('No readable text was found in this PDF (it may be scanned images without OCR text).')
  }

  return { title, author, text: pageTexts.join('\n\n') }
}
