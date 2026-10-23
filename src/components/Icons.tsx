type IconProps = { size?: number; className?: string }

export function ReplyIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 4.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H9l-4.5 4V17H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function RetweetIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M5 7h11v3l4-4.5L16 1v3H5a2 2 0 0 0-2 2v5h2V7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M19 17H8v-3l-4 4.5L8 23v-3h11a2 2 0 0 0 2-2v-5h-2v5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function HeartIcon({ size = 18, className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} className={className}>
      <path
        d="M12 20.5s-7.5-4.6-10-9.3C.6 8.2 2 5 5.3 4.4c2-.4 3.9.6 5 2.4a1 1 0 0 0 1.4 0c1.1-1.8 3-2.8 5-2.4C19.9 5 21.4 8.2 20 11.2c-2.5 4.7-8 9.3-8 9.3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ShareIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 15V3M12 3 7 8M12 3l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BackIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15 5 7 12l8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BookIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2V5Z M20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-2V5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TrashIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M5 7h14M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2m-8 0 .8 12.1A2 2 0 0 0 8.8 21h6.4a2 2 0 0 0 2-1.9L18 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function VerifiedBadge({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 1.5 14.7 4l3.5-.6 1 3.4 3 1.9-1.5 3.3 1.5 3.3-3 1.9-1 3.4-3.5-.6L12 22.5 9.3 20l-3.5.6-1-3.4-3-1.9L3.3 12 1.8 8.7l3-1.9 1-3.4L9.3 4 12 1.5Z" />
      <path d="M8.5 12.2 11 14.7 15.8 9.5" stroke="#000" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LinkIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M9.5 14.5 14.5 9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M11 7.5 12.3 6.2a3.5 3.5 0 0 1 4.9 0l.6.6a3.5 3.5 0 0 1 0 4.9L16.5 13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M13 16.5 11.7 17.8a3.5 3.5 0 0 1-4.9 0l-.6-.6a3.5 3.5 0 0 1 0-4.9L7.5 11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function VideoIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2.5" y="5.5" width="14" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M21.5 9.2 17 11.6v.8l4.5 2.4a1 1 0 0 0 1.5-.9V10a1 1 0 0 0-1.5-.8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 9.5v5l4-2.5-4-2.5Z" fill="currentColor" />
    </svg>
  )
}

export function UploadIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 16V4M12 4 7 9M12 4l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
