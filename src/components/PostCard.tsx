import { useState } from 'react'
import type { Post } from '../types'
import { statsFor, formatCount } from '../lib/fakeStats'
import { HeartIcon, ReplyIcon, RetweetIcon, ShareIcon, VerifiedBadge } from './Icons'

interface PostCardProps {
  post: Post
  index: number
  displayName: string
  handle: string
  avatar: string | null
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

export function PostCard({ post, index, displayName, handle, avatar }: PostCardProps) {
  const [liked, setLiked] = useState(false)
  const [retweeted, setRetweeted] = useState(false)
  const stats = statsFor(post.text, String(index))

  if (post.type === 'heading') {
    return (
      <div className="chapter-divider" data-index={index}>
        <span className="chapter-divider-pill">{post.text}</span>
      </div>
    )
  }

  const likeCount = stats.likes + (liked ? 1 : 0)
  const retweetCount = stats.retweets + (retweeted ? 1 : 0)

  return (
    <article className="post-card" data-index={index}>
      <div className="post-avatar">
        {avatar ? <img src={avatar} alt="" /> : <span>{initialsFor(displayName)}</span>}
      </div>
      <div className="post-body">
        <div className="post-head">
          <span className="post-name">{displayName}</span>
          <VerifiedBadge className="post-verified" size={15} />
          <span className="post-handle">{handle}</span>
          <span className="post-dot">·</span>
          <span className="post-meta">{post.chapterTitle}</span>
        </div>
        <p className="post-text">{post.text}</p>
        <div className="post-actions">
          <button className="post-action" type="button" aria-label="Reply">
            <ReplyIcon size={17} />
            <span>{formatCount(stats.replies)}</span>
          </button>
          <button
            className={`post-action ${retweeted ? 'is-retweeted' : ''}`}
            type="button"
            aria-label="Retweet"
            onClick={() => setRetweeted((v) => !v)}
          >
            <RetweetIcon size={17} />
            <span>{formatCount(retweetCount)}</span>
          </button>
          <button
            className={`post-action ${liked ? 'is-liked' : ''}`}
            type="button"
            aria-label="Like"
            onClick={() => setLiked((v) => !v)}
          >
            <HeartIcon size={17} filled={liked} />
            <span>{formatCount(likeCount)}</span>
          </button>
          <button className="post-action" type="button" aria-label="Share">
            <ShareIcon size={16} />
          </button>
        </div>
      </div>
    </article>
  )
}
