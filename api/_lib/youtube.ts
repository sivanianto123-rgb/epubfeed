export interface TranscriptResult {
  title: string
  author: string
  text: string
}

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind?: string
}

function extractVideoId(input: string): string | null {
  try {
    const url = new URL(input)
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1) || null
    if (url.searchParams.has('v')) return url.searchParams.get('v')
    const embedMatch = url.pathname.match(/\/embed\/([^/?]+)/)
    if (embedMatch) return embedMatch[1]
    const shortsMatch = url.pathname.match(/\/shorts\/([^/?]+)/)
    if (shortsMatch) return shortsMatch[1]
  } catch {
    if (/^[\w-]{11}$/.test(input)) return input
  }
  return null
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n/g, ' ')
}

function extractJsonField(html: string, key: string): string | null {
  const match = html.match(new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`))
  if (!match) return null
  try {
    return JSON.parse(`"${match[1]}"`)
  } catch {
    return match[1]
  }
}

/**
 * Best-effort transcript fetch via YouTube's public (unofficial) caption
 * track URLs embedded in the watch page — not the official Data API, which
 * requires separate OAuth/quota setup. This can break if YouTube changes
 * their page structure, and only works for videos that have captions.
 */
export async function fetchYoutubeTranscript(input: string): Promise<TranscriptResult> {
  const videoId = extractVideoId(input)
  if (!videoId) throw new Error('Could not find a YouTube video ID in that link.')

  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; epubfeed/1.0)' },
  })
  if (!pageRes.ok) throw new Error(`Could not load that YouTube video (${pageRes.status}).`)
  const html = await pageRes.text()

  const title = extractJsonField(html, 'title') || 'YouTube video'
  const author = extractJsonField(html, 'author') || 'Unknown Channel'

  const tracksMatch = html.match(/"captionTracks":(\[.*?\])/)
  if (!tracksMatch) {
    throw new Error('This video has no captions/transcript available.')
  }

  let tracks: CaptionTrack[]
  try {
    tracks = JSON.parse(tracksMatch[1])
  } catch {
    throw new Error('Could not read this video’s caption list.')
  }

  const track =
    tracks.find((t) => t.languageCode?.startsWith('en') && !t.kind) ||
    tracks.find((t) => t.languageCode?.startsWith('en')) ||
    tracks[0]
  if (!track) throw new Error('This video has no captions/transcript available.')

  const captionRes = await fetch(track.baseUrl)
  if (!captionRes.ok) throw new Error('Could not fetch the transcript for this video.')
  const xml = await captionRes.text()

  const text = Array.from(xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g))
    .map((m) => decodeEntities(m[1]))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) throw new Error('This video has no usable transcript text.')

  return { title, author, text }
}
