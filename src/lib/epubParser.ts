import JSZip from 'jszip'
import type { ChapterParagraph, ParsedBook, ParsedChapter } from '../types'

const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, blockquote, li'
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6'

// EPUB3 semantic inflection (epub:type) and common Standard-Ebooks-style
// filenames for front/back matter that isn't the actual story.
const BOILERPLATE_EPUB_TYPES = new Set([
  'cover',
  'titlepage',
  'halftitlepage',
  'imprint',
  'colophon',
  'copyright-page',
  'uncopyright',
  'toc',
  'landmarks',
  'loi',
  'lot',
])
const BOILERPLATE_FILENAME_RE =
  /(^|\/)(cover|title-?page|half-?title-?page|imprint|colophon|un-?copyright|copyright)(\.x?html?)?$/i

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

function isNoteRef(el: Element): boolean {
  const type = (el.getAttribute('epub:type') || '').toLowerCase()
  const role = el.getAttribute('role') || ''
  return type.includes('noteref') || role === 'doc-noteref' || el.tagName.toLowerCase() === 'sup'
}

/** Walks an element's children, preserving emphasis as lightweight markers
 * (`_italic_`, `**bold**`) and dropping footnote/endnote reference markers
 * so they don't leak stray numbers into the prose. */
function extractRichText(node: Node): string {
  let out = ''
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent || ''
      return
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const el = child as Element
    if (isNoteRef(el)) return
    const tag = el.tagName.toLowerCase()
    const inner = extractRichText(el)
    if (tag === 'em' || tag === 'i') out += `_${inner}_`
    else if (tag === 'strong' || tag === 'b') out += `**${inner}**`
    else out += inner
  })
  return out
}

/** Turns a bare chapter numeral ("1", "I.") into a readable label. Leaves
 * real titles untouched. */
function normalizeHeadingLabel(raw: string | undefined, fallbackIndex: number): string {
  const trimmed = (raw || '').trim()
  const isBareNumeral = /^(chapter\s*)?[ivxlcdm]+\.?$/i.test(trimmed) || /^\d+\.?$/.test(trimmed)
  if (!trimmed || isBareNumeral) {
    const numPart = trimmed.replace(/^chapter\s*/i, '').replace(/\.$/, '')
    return numPart ? `Chapter ${numPart}` : `Chapter ${fallbackIndex + 1}`
  }
  return trimmed
}

function collectEpubTypes(doc: Document): Set<string> {
  const types = new Set<string>()
  const addFrom = (el: Element | null) => {
    const val = el?.getAttribute('epub:type')
    if (val)
      val
        .split(/\s+/)
        .filter(Boolean)
        .forEach((t) => types.add(t.toLowerCase()))
  }
  addFrom(doc.body)
  doc.body?.querySelectorAll('section, article, div, nav').forEach((el) => addFrom(el))
  return types
}

function isBoilerplateChapter(href: string, epubTypes: Set<string>): boolean {
  for (const t of epubTypes) {
    if (BOILERPLATE_EPUB_TYPES.has(t)) return true
  }
  return BOILERPLATE_FILENAME_RE.test(href)
}

function extractParagraphs(xhtml: string): {
  paragraphs: ChapterParagraph[]
  firstHeading?: string
  epubTypes: Set<string>
} {
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
    const heading = el.matches?.(HEADING_SELECTOR) ?? false
    const text = heading
      ? collapseWhitespace(el.textContent || '')
      : collapseWhitespace(extractRichText(el))
    if (!text) continue
    if (heading && !firstHeading) firstHeading = text
    paragraphs.push({ text, heading })
  }

  return { paragraphs, firstHeading, epubTypes: collectEpubTypes(doc) }
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
    const { paragraphs, firstHeading, epubTypes } = extractParagraphs(xhtml)
    if (paragraphs.length === 0) continue
    if (isBoilerplateChapter(item.href, epubTypes)) continue
    chapters.push({
      title: normalizeHeadingLabel(firstHeading, chapters.length),
      paragraphs,
    })
  }

  if (chapters.length === 0) {
    throw new Error('No readable text content was found in this EPUB.')
  }

  return { title, author, coverDataUrl, chapters }
}
