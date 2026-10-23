function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export interface FakeStats {
  replies: number
  retweets: number
  likes: number
}

export function statsFor(text: string, seedExtra: string): FakeStats {
  const h = hashString(text + seedExtra)
  return {
    replies: h % 47,
    retweets: (h >>> 5) % 23,
    likes: (h >>> 11) % 340,
  }
}

export function formatCount(n: number): string {
  if (n <= 0) return ''
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
}
