import { useState } from 'react'
import type { ChapterThreadInfo, PassageQuote, Post } from '../types'
import { RichText, visibleLength } from './RichText'
import { ShareIcon, VerifiedBadge } from './Icons'

const CLAMP_THRESHOLD = 280

interface PostCardProps {
  post: Post
  index: number
  displayName: string
  handle: string
  avatar: string | null
  threaded: boolean
  highlighted: boolean
  onToggleHighlight: (index: number) => void
  passageQuote?: PassageQuote
  chapterThread?: ChapterThreadInfo
  discussionsMock: boolean
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

export function PostCard({
  post,
  index,
  displayName,
  handle,
  avatar,
  threaded,
  highlighted,
  onToggleHighlight,
  passageQuote,
  chapterThread,
  discussionsMock,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')

  if (post.type === 'heading') {
    return (
      <div className="chapter-divider" data-index={index}>
        <span className="chapter-divider-ornament" aria-hidden="true">✦</span>
        <span className="chapter-divider-pill">{post.text}</span>
        {chapterThread && (
          <a
            className="chapter-thread-link"
            href={chapterThread.permalink}
            target={discussionsMock ? undefined : '_blank'}
            rel="noreferrer"
            onClick={discussionsMock ? (e) => e.preventDefault() : undefined}
          >
            💬 r/{chapterThread.subreddit} discussed this{discussionsMock ? ' (demo)' : ''} →
          </a>
        )}
      </div>
    )
  }

  const isLong = visibleLength(post.text) > CLAMP_THRESHOLD
  const timeLeft = post.minutesLeft <= 1 ? '<1m left' : `${post.minutesLeft}m left`
  const plainText = post.text.replace(/[_*]/g, '')

  const handleShare = async () => {
    const shareData = { text: `"${plainText}" — ${displayName}, ${post.chapterTitle}` }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // User cancelled the share sheet — not an error.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(shareData.text)
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 1500)
    } catch {
      // Clipboard access denied — nothing more we can do silently.
    }
  }

  return (
    <article className={`post-card ${threaded ? 'post-card--threaded' : ''}`} data-index={index}>
      <div className="post-avatar-col">
        <div className="post-avatar">
          {avatar ? <img src={avatar} alt="" /> : <span>{initialsFor(displayName)}</span>}
        </div>
        {threaded && <div className="thread-line" />}
      </div>
      <div className="post-body">
        <div className="post-head">
          <span className="post-name">{displayName}</span>
          <VerifiedBadge className="post-verified" size={15} />
          <span className="post-handle">{handle}</span>
          <span className="post-dot">·</span>
          <span className="post-meta">
            {post.chapterTitle} · {timeLeft}
          </span>
        </div>
        <p className={`post-text ${isLong && !expanded ? 'is-clamped' : ''}`}>
          <RichText text={post.text} />
        </p>
        {isLong && !expanded && (
          <button className="show-more" type="button" onClick={() => setExpanded(true)}>
            Show more
          </button>
        )}
        {passageQuote && (
          <a
            className="reader-quote"
            href={passageQuote.permalink}
            target={discussionsMock ? undefined : '_blank'}
            rel="noreferrer"
            onClick={discussionsMock ? (e) => e.preventDefault() : undefined}
          >
            <span className="reader-quote-icon">💬</span>
            <span className="reader-quote-body">
              <span className="reader-quote-text">“{passageQuote.text}”</span>
              <span className="reader-quote-source">
                u/{passageQuote.author} · r/{passageQuote.subreddit}
                {discussionsMock ? ' · demo' : ''}
              </span>
            </span>
          </a>
        )}
        <div className="post-actions">
          <button
            className={`post-action ${highlighted ? 'is-highlighted' : ''}`}
            type="button"
            aria-label="Highlight"
            onClick={() => onToggleHighlight(index)}
          >
            <span className="post-action-emoji">{highlighted ? '★' : '☆'}</span>
            <span>Highlight</span>
          </button>
          <button className="post-action" type="button" aria-label="Share" onClick={handleShare}>
            <ShareIcon size={16} />
            <span>{shareState === 'copied' ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </div>
    </article>
  )
}
