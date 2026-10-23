/** Renders the lightweight `_italic_` / `**bold**` markers produced by the
 * EPUB parser as real <em>/<strong> elements. */
export function RichText({ text }: { text: string }) {
  const nodes: React.ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*|_(.+?)_/g
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    if (match[1] !== undefined) nodes.push(<strong key={key++}>{match[1]}</strong>)
    else if (match[2] !== undefined) nodes.push(<em key={key++}>{match[2]}</em>)
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))

  return <>{nodes}</>
}

/** Visible character length, ignoring markup markers — used to decide
 * whether a post needs a "Show more" truncation. */
export function visibleLength(text: string): number {
  return text.replace(/[_*]/g, '').length
}
