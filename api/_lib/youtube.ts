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

const FETCH_TIMEOUT_MS = 8000

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

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('YouTube took too long to respond. Try again in a moment.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** Finds `marker = {...}` in the page and extracts the balanced JSON object
 * that follows it, respecting string literals so braces inside quoted
 * strings don't throw off the depth count. Far more reliable than a loose
 * regex for a specific field, which can match the wrong occurrence of a
 * common key name like "title" or "author" elsewhere on the page. */
function extractBalancedJson(html: string, marker: string): string | null {
  const markerIndex = html.indexOf(marker)
  if (markerIndex < 0) return null
  const start = html.indexOf('{', markerIndex)
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return html.slice(start, i + 1)
    }
  }
  return null
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

function getVideoDetails(html: string): { title?: string; author?: string } {
  const json = extractBalancedJson(html, 'ytInitialPlayerResponse')
  if (!json) return {}
  try {
    const parsed = JSON.parse(json) as { videoDetails?: { title?: string; author?: string } }
    return { title: parsed.videoDetails?.title, author: parsed.videoDetails?.author }
  } catch {
    return {}
  }
}

/**
 * Best-effort transcript fetch via YouTube's public (unofficial) caption
 * track URLs embedded in the watch page — not the official Data API, which
 * requires separate OAuth/quota setup. This can break if YouTube changes
 * their page structure, blocks automated requests from this server, or
 * shows a region-specific cookie-consent page instead of the real one —
 * and only works for videos that have captions.
 */
export async function fetchYoutubeTranscript(input: string): Promise<TranscriptResult> {
  const videoId = extractVideoId(input)
  if (!videoId) throw new Error('Could not find a YouTube video ID in that link.')

  const pageRes = await fetchWithTimeout(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; epubfeed/1.0)' },
  })
  if (!pageRes.ok) throw new Error(`Could not load that YouTube video (${pageRes.status}).`)
  const html = await pageRes.text()

  if (html.includes('consent.youtube.com') || html.includes('action="https://consent.youtube.com')) {
    throw new Error('YouTube showed a cookie-consent page instead of the video — this server could not get past it automatically.')
  }

  const details = getVideoDetails(html)
  const title = details.title || extractJsonField(html, 'title') || 'YouTube video'
  const author = details.author || extractJsonField(html, 'author') || 'Unknown Channel'

  const tracksMatch = html.match(/"captionTracks":(\[.*?\])/)
  if (!tracksMatch) {
    if (!html.includes('ytInitialPlayerResponse')) {
      throw new Error('YouTube blocked this request. Try again in a moment.')
    }
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

  const captionRes = await fetchWithTimeout(track.baseUrl)
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
