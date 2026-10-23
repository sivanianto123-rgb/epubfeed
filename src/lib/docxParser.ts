import mammoth from 'mammoth'
import JSZip from 'jszip'
import type { PlainTextSource } from './pdfParser'

async function extractDocxMetadata(data: ArrayBuffer): Promise<{ title?: string; author?: string }> {
  try {
    const zip = await JSZip.loadAsync(data)
    const coreXml = await zip.file('docProps/core.xml')?.async('text')
    if (!coreXml) return {}
    const doc = new DOMParser().parseFromString(coreXml, 'application/xml')
    const title = doc.getElementsByTagName('dc:title')[0]?.textContent?.trim() || undefined
    const author = doc.getElementsByTagName('dc:creator')[0]?.textContent?.trim() || undefined
    return { title, author }
  } catch {
    return {}
  }
}

export async function parseDocx(file: File | ArrayBuffer): Promise<PlainTextSource> {
  const data = file instanceof File ? await file.arrayBuffer() : file
  const [result, meta] = await Promise.all([mammoth.extractRawText({ arrayBuffer: data }), extractDocxMetadata(data)])

  const text = result.value.replace(/\n{3,}/g, '\n\n').trim()
  if (!text) {
    throw new Error('No readable text was found in this Word document.')
  }

  const fallbackTitle = file instanceof File ? file.name.replace(/\.docx$/i, '') : 'Untitled document'
  return {
    title: meta.title || fallbackTitle,
    author: meta.author || 'Unknown Author',
    text,
  }
}
