/** Small hand-drawn-style line-art flourishes for the landing hero.
 * Original artwork — simple everyday objects (book, mug, glasses, lamp,
 * sparkles, bookmark, ink bottle), drawn fresh for this app. */

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function OpenBookDoodle() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34" {...common}>
      <path d="M23 7C19 4 13 3 4 4v22c9-1 15 0 19 3" />
      <path d="M23 7c4-3 10-4 19-3v22c-9-1-15 0-19 3" />
      <path d="M23 7v26" />
      <path d="M8 11c4-1 8-1 11 1M8 17c4-1 8-1 11 1M35 11c-4-1-8-1-11 1M35 17c-4-1-8-1-11 1" />
    </svg>
  )
}

function MugDoodle() {
  return (
    <svg width="30" height="34" viewBox="0 0 30 34" {...common}>
      <path d="M5 13h14v11a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V13Z" />
      <path d="M19 16h3a3.5 3.5 0 0 1 0 7h-3" />
      <path d="M9 5c-1 2 1 2 0 4M14 4c-1 2 1 2 0 4M19 5c-1 2 1 2 0 4" />
    </svg>
  )
}

function GlassesDoodle() {
  return (
    <svg width="44" height="22" viewBox="0 0 44 22" {...common}>
      <circle cx="11" cy="11" r="8.5" />
      <circle cx="33" cy="11" r="8.5" />
      <path d="M19.5 9c1-2 4-2 5 0" />
      <path d="M2.5 9 0 7M41.5 9 44 7" />
    </svg>
  )
}

function LampDoodle() {
  return (
    <svg width="34" height="36" viewBox="0 0 34 36" {...common}>
      <path d="M4 33h18" />
      <path d="M13 33V26l9-15" />
      <path d="M17 7a4 4 0 1 1 8 0" />
      <path d="M13 11h16l-3 8H16Z" />
      <path d="M8 16 5 13M8 19H4M8 22l-3 2" />
    </svg>
  )
}

function SparklesDoodle() {
  return (
    <svg width="26" height="30" viewBox="0 0 26 30" {...common}>
      <path d="M8 2c0 4 2.5 6.5 6.5 6.5C10.5 8.5 8 11 8 15c0-4-2.5-6.5-6.5-6.5C5.5 8.5 8 6 8 2Z" />
      <path d="M19 15c0 2.6 1.6 4.3 4.3 4.3-2.7 0-4.3 1.7-4.3 4.3 0-2.6-1.6-4.3-4.3-4.3 2.7 0 4.3-1.7 4.3-4.3Z" />
    </svg>
  )
}

function BookmarkDoodle() {
  return (
    <svg width="22" height="34" viewBox="0 0 22 34" {...common}>
      <path d="M3 2h16v30l-8-7-8 7Z" />
    </svg>
  )
}

function InkBottleDoodle() {
  return (
    <svg width="26" height="34" viewBox="0 0 26 34" {...common}>
      <rect x="3" y="12" width="20" height="19" rx="2" />
      <path d="M9 12V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5" />
      <path d="M6 5h14" />
      <rect x="8" y="19" width="10" height="6" rx="1" />
    </svg>
  )
}

export function DoodleStrip() {
  return (
    <div className="doodle-strip" aria-hidden="true">
      <OpenBookDoodle />
      <MugDoodle />
      <GlassesDoodle />
      <LampDoodle />
      <SparklesDoodle />
      <BookmarkDoodle />
      <InkBottleDoodle />
    </div>
  )
}
