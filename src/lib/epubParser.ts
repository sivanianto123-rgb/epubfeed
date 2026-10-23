import JSZip from 'jszip'
import type { ChapterParagraph, ParsedBook, ParsedChapter } from '../types'

const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, blockquote, li'
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6'

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function joinPath(dir: string, href: string): string {
  const decoded = decodeURIComponent(href.split('#')[0])
  const combined = dir ? `${dir}/${decoded}` : decoded
  const stack: string[] = []
  for (const part of combined.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return stack.join('/')
}

function getFirstTagText(doc: Document, tagName: string): string | undefined {
  const el = doc.getElementsByTagName(tagName)[0]
  return el?.textContent?.trim() || undefined
}

function extractParagraphs(xhtml: string): { paragraphs: ChapterParagraph[]; firstHeading?: string } {
  let doc = new DOMParser().parseFromString(xhtml, 'application/xhtml+xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    doc = new DOMParser().parseFromString(xhtml, 'text/html')
  }
  const body = doc.body || doc.documentElement
  const all = Array.from(body.querySelectorAll(BLOCK_SELECTOR))
  const blocks = all.filter((el) => !el.parentElement?.closest(BLOCK_SELECTOR))

  const paragraphs: ChapterParagraph[] = []
  let firstHeading: string | undefined

  const source = blocks.length > 0 ? blocks : [body]
  for (const el of source) {
    const text = collapseWhitespace(el.textContent || '')
    if (!text) continue
    const heading = el.matches?.(HEADING_SELECTOR) ?? false
    if (heading && !firstHeading) firstHeading = text
    paragraphs.push({ text, heading })
  }

  return { paragraphs, firstHeading }
}

export async function parseEpub(file: File | ArrayBuffer): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(file)

  const containerXml = await zip.file('META-INF/container.xml')?.async('text')
  if (!containerXml) throw new Error('This file does not look like a valid EPUB (missing container.xml).')
  const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml')
  const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path')
  if (!opfPath) throw new Error('This file does not look like a valid EPUB (missing OPF reference).')

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : ''
  const opfXml = await zip.file(opfPath)?.async('text')
  if (!opfXml) throw new Error('This file does not look like a valid EPUB (missing OPF file).')
  const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml')

  const title = getFirstTagText(opfDoc, 'dc:title') || getFirstTagText(opfDoc, 'title') || 'Untitled'
  const author =
    getFirstTagText(opfDoc, 'dc:creator') || getFirstTagText(opfDoc, 'creator') || 'Unknown Author'

  const manifestItems: Record<string, { href: string; mediaType: string; properties?: string }> = {}
  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (!id || !href) return
    manifestItems[id] = {
      href,
      mediaType: item.getAttribute('media-type') || '',
      properties: item.getAttribute('properties') || undefined,
    }
  })

  let coverHref: string | undefined
  for (const id in manifestItems) {
    if (manifestItems[id].properties?.includes('cover-image')) {
      coverHref = manifestItems[id].href
      break
    }
  }
  if (!coverHref) {
    const metaCover = Array.from(opfDoc.querySelectorAll('metadata > meta')).find(
      (m) => m.getAttribute('name') === 'cover',
    )
    const coverId = metaCover?.getAttribute('content') || undefined
    if (coverId && manifestItems[coverId]) coverHref = manifestItems[coverId].href
  }
  if (!coverHref) {
    const imageItem = Object.values(manifestItems).find((item) => item.mediaType.startsWith('image/'))
    coverHref = imageItem?.href
  }

  let coverDataUrl: string | null = null
  if (coverHref) {
    const coverPath = joinPath(opfDir, coverHref)
    const coverFile = zip.file(coverPath)
    if (coverFile) {
      const base64 = await coverFile.async('base64')
      const mediaType = Object.values(manifestItems).find((i) => i.href === coverHref)?.mediaType || 'image/jpeg'
      coverDataUrl = `data:${mediaType};base64,${base64}`
    }
  }

  const spineIds = Array.from(opfDoc.querySelectorAll('spine > itemref')).map((el) => el.getAttribute('idref'))

  const chapters: ParsedChapter[] = []
  for (const id of spineIds) {
    if (!id || !manifestItems[id]) continue
    const item = manifestItems[id]
    if (!item.mediaType.includes('html') && !item.mediaType.includes('xml')) continue
    const path = joinPath(opfDir, item.href)
    const xhtml = await zip.file(path)?.async('text')
    if (!xhtml) continue
    const { paragraphs, firstHeading } = extractParagraphs(xhtml)
    if (paragraphs.length === 0) continue
    chapters.push({
      title: firstHeading || `Chapter ${chapters.length + 1}`,
      paragraphs,
    })
  }

  if (chapters.length === 0) {
    throw new Error('No readable text content was found in this EPUB.')
  }

  return { title, author, coverDataUrl, chapters }
}
