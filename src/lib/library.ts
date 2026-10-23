import { get, set, del } from 'idb-keyval'
import type { LibraryEntry, StoredBook, Post } from '../types'
import { computeWordProgress } from './progress'

const INDEX_KEY = 'epubfeed:index'
const bookKey = (id: string) => `epubfeed:book:${id}`

export async function getLibrary(): Promise<LibraryEntry[]> {
  return (await get(INDEX_KEY)) || []
}

async function saveLibrary(entries: LibraryEntry[]): Promise<void> {
  await set(INDEX_KEY, entries)
}

export async function addBook(
  meta: Omit<LibraryEntry, 'currentIndex' | 'progressPct'>,
  posts: Post[],
): Promise<LibraryEntry> {
  const entry: LibraryEntry = { ...meta, currentIndex: 0, progressPct: 0 }
  const lib = await getLibrary()
  lib.unshift(entry)
  await saveLibrary(lib)
  await set(bookKey(meta.id), { meta: entry, posts, highlights: [] } as StoredBook)
  return entry
}

export async function getBook(id: string): Promise<StoredBook | undefined> {
  return await get(bookKey(id))
}

export async function updateProgress(id: string, currentIndex: number): Promise<void> {
  const stored = await get<StoredBook>(bookKey(id))
  const progressPct = stored ? computeWordProgress(stored.posts, currentIndex) : 0

  const lib = await getLibrary()
  const idx = lib.findIndex((b) => b.id === id)
  if (idx >= 0) {
    lib[idx] = { ...lib[idx], currentIndex, progressPct }
    await saveLibrary(lib)
  }
  if (stored) {
    stored.meta.currentIndex = currentIndex
    stored.meta.progressPct = progressPct
    await set(bookKey(id), stored)
  }
}

export async function toggleHighlight(id: string, postIndex: number): Promise<boolean> {
  const stored = await get<StoredBook>(bookKey(id))
  if (!stored) return false
  const highlighted = new Set(stored.highlights || [])
  const nowOn = !highlighted.has(postIndex)
  if (nowOn) highlighted.add(postIndex)
  else highlighted.delete(postIndex)
  stored.highlights = Array.from(highlighted)
  await set(bookKey(id), stored)
  return nowOn
}

export async function saveChapterSummary(id: string, chapterIndex: number, summary: string): Promise<void> {
  const stored = await get<StoredBook>(bookKey(id))
  if (!stored) return
  stored.chapterSummaries = { ...(stored.chapterSummaries || {}), [chapterIndex]: summary }
  await set(bookKey(id), stored)
}

export async function toggleBookmark(id: string, chapterIndex: number): Promise<boolean> {
  const stored = await get<StoredBook>(bookKey(id))
  if (!stored) return false
  const bookmarked = new Set(stored.bookmarks || [])
  const nowOn = !bookmarked.has(chapterIndex)
  if (nowOn) bookmarked.add(chapterIndex)
  else bookmarked.delete(chapterIndex)
  stored.bookmarks = Array.from(bookmarked)
  await set(bookKey(id), stored)
  return nowOn
}

export async function toggleLove(id: string, chapterIndex: number): Promise<boolean> {
  const stored = await get<StoredBook>(bookKey(id))
  if (!stored) return false
  const loved = new Set(stored.loves || [])
  const nowOn = !loved.has(chapterIndex)
  if (nowOn) loved.add(chapterIndex)
  else loved.delete(chapterIndex)
  stored.loves = Array.from(loved)
  await set(bookKey(id), stored)
  return nowOn
}

export async function removeBook(id: string): Promise<void> {
  const lib = await getLibrary()
  await saveLibrary(lib.filter((b) => b.id !== id))
  await del(bookKey(id))
}
