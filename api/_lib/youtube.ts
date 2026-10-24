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

// Vercel's default Serverless Function execution limit is 10s — up to two
// player-API attempts plus the caption fetch happen sequentially, so their
// timeouts must sum to comfortably less than that.
const PLAYER_FETCH_TIMEOUT_MS = 3000
const CAPTION_FETCH_TIMEOUT_MS = 2000

interface ClientConfig {
  key: string
  clientName: string
  clientVersion: string
  extra?: Record<string, unknown>
}

// YouTube's internal player endpoint, called with its own public client
// keys — the same technique widely-used YouTube tools (e.g. yt-dlp) rely
// on, and far more reliable than scraping the watch page's HTML for
// embedded JSON, which YouTube has increasingly stripped caption data
// from in recent years. Tried in order: the "WEB" client is attempted
// first, but YouTube's anti-bot wall ("Sign in to confirm you're not a
// bot") applies much more aggressively to it from cloud/datacenter IPs
// than to the "ANDROID" client, which the official Android app itself
// uses — so that's the fallback when WEB gets blocked.
const CLIENT_CONFIGS: ClientConfig[] = [
  { key: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', clientName: 'WEB', clientVersion: '2.20240530.01.00' },
  {
    key: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
    clientName: 'ANDROID',
    clientVersion: '19.09.37',
    extra: { androidSdkVersion: 30 },
  },
]

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

function isBotBlocked(player: PlayerResponse): boolean {
  const status = player.playabilityStatus?.status
  const reason = player.playabilityStatus?.reason || ''
  return status === 'LOGIN_REQUIRED' || /not a bot/i.test(reason)
}

async function fetchPlayerResponseWithClient(videoId: string, config: ClientConfig): Promise<PlayerResponse> {
  const res = await fetchWithTimeout(
    `https://www.youtube.com/youtubei/v1/player?key=${config.key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: config.clientName,
            clientVersion: config.clientVersion,
            hl: 'en',
            gl: 'US',
            ...config.extra,
          },
        },
      }),
    },
    PLAYER_FETCH_TIMEOUT_MS,
  )
  if (!res.ok) throw new Error(`Could not load that YouTube video (${res.status}).`)
  return (await res.json()) as PlayerResponse
}

/** Tries each client config in order, stopping at the first one that
 * isn't itself blocked by YouTube's anti-bot wall. A later config failing
 * outright (wrong key, bad request, network hiccup) never discards a
 * usable result an earlier config already got — it's just skipped, so one
 * broken fallback can't regress a client that was already working. Only
 * throws if every single config failed outright with no usable response
 * at all. */
async function fetchPlayerResponse(videoId: string): Promise<PlayerResponse> {
  let lastResult: PlayerResponse | null = null
  let lastError: unknown = null
  for (const config of CLIENT_CONFIGS) {
    try {
      const player = await fetchPlayerResponseWithClient(videoId, config)
      if (!isBotBlocked(player)) return player
      lastResult = player
    } catch (err) {
      lastError = err
    }
  }
  if (lastResult) return lastResult
  throw lastError instanceof Error ? lastError : new Error('Could not load that YouTube video.')
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
    const reason = player.playabilityStatus?.reason || ''
    if (status === 'LOGIN_REQUIRED' || /not a bot/i.test(reason)) {
      throw new Error(
        'YouTube is blocking automated requests from this server right now. This is a known restriction on cloud-hosted requests, not a bug — try again later, or use a different source for this content.',
      )
    }
    throw new Error(reason || 'This video is not available.')
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
