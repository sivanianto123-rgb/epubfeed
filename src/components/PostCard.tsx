import { useState } from 'react'
import type { ChapterThreadInfo, PassageQuote, Post } from '../types'
import { statsFor, formatCount } from '../lib/fakeStats'
import { RichText, visibleLength } from './RichText'
import { ReplyIcon, ShareIcon, VerifiedBadge } from './Icons'

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
  const stats = statsFor(post.text, String(index))

  if (post.type === 'heading') {
    return (
      <div className="chapter-divider" data-index={index}>
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
          <button className="post-action" type="button" aria-label="Reply">
            <ReplyIcon size={17} />
            <span>{formatCount(stats.replies)}</span>
          </button>
          <span className="post-action post-action--static" aria-label="Readers">
            <span className="post-action-emoji">💬</span>
            <span>{formatCount(stats.likes)} readers</span>
          </span>
          <button
            className={`post-action ${highlighted ? 'is-highlighted' : ''}`}
            type="button"
            aria-label="Highlight"
            onClick={() => onToggleHighlight(index)}
          >
            <span className="post-action-emoji">{highlighted ? '★' : '☆'}</span>
            <span>Highlight</span>
          </button>
          <button className="post-action" type="button" aria-label="Share">
            <ShareIcon size={16} />
          </button>
        </div>
      </div>
    </article>
  )
}
