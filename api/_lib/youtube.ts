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

interface PlayerResponse {
  playabilityStatus?: { status?: string; reason?: string }
  videoDetails?: { title?: string; author?: string }
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } }
}

// Vercel's default Serverless Function execution limit is 10s — these two
// fetches happen sequentially, so their timeouts must sum to comfortably
// less than that.
const PLAYER_FETCH_TIMEOUT_MS = 5500
const CAPTION_FETCH_TIMEOUT_MS = 3000

// YouTube's own public "WEB" client key and the internal player endpoint its
// web frontend calls — the same technique widely-used YouTube tools (e.g.
// yt-dlp) rely on, and far more reliable than scraping the watch page's
// HTML for embedded JSON, which YouTube has increasingly stripped caption
// data from in recent years.
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'
const INNERTUBE_ENDPOINT = `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`

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

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
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

async function fetchPlayerResponse(videoId: string): Promise<PlayerResponse> {
  const res = await fetchWithTimeout(
    INNERTUBE_ENDPOINT,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240530.01.00',
            hl: 'en',
            gl: 'US',
          },
        },
      }),
    },
    PLAYER_FETCH_TIMEOUT_MS,
  )
  if (!res.ok) throw new Error(`Could not load that YouTube video (${res.status}).`)
  return (await res.json()) as PlayerResponse
}

/**
 * Best-effort transcript fetch via YouTube's internal (unofficial) player
 * API — not the official Data API, which requires separate OAuth/quota
 * setup. This can break if YouTube changes that API's shape or blocks
 * automated requests from this server, and only works for videos that have
 * captions.
 */
export async function fetchYoutubeTranscript(input: string): Promise<TranscriptResult> {
  const videoId = extractVideoId(input)
  if (!videoId) throw new Error('Could not find a YouTube video ID in that link.')

  const player = await fetchPlayerResponse(videoId)

  const status = player.playabilityStatus?.status
  if (status && status !== 'OK') {
    throw new Error(player.playabilityStatus?.reason || 'This video is not available.')
  }

  const title = player.videoDetails?.title || 'YouTube video'
  const author = player.videoDetails?.author || 'Unknown Channel'

  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
  if (tracks.length === 0) {
    throw new Error('This video has no captions/transcript available.')
  }

  const track =
    tracks.find((t) => t.languageCode?.startsWith('en') && !t.kind) ||
    tracks.find((t) => t.languageCode?.startsWith('en')) ||
    tracks[0]

  const captionRes = await fetchWithTimeout(track.baseUrl, {}, CAPTION_FETCH_TIMEOUT_MS)
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
