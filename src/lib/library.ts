import { get, set, del } from 'idb-keyval'
import type { LibraryEntry, StoredBook, Post } from '../types'
import { computeWordProgress } from './progress'
import { getCurrentUser } from './auth'
import { fetchCloudBook, fetchCloudIndex, pushCloudBook, pushCloudIndex, deleteCloudBook } from './cloudSync'

const INDEX_KEY = 'epubfeed:index'
const bookKey = (id: string) => `epubfeed:book:${id}`

function syncIndexToCloud(entries: LibraryEntry[]): void {
  const user = getCurrentUser()
  if (user) void pushCloudIndex(user.uid, entries)
}

function syncBookToCloud(book: StoredBook): void {
  const user = getCurrentUser()
  if (user) void pushCloudBook(user.uid, book)
}

export async function getLibrary(): Promise<LibraryEntry[]> {
  return (await get(INDEX_KEY)) || []
}

async function saveLibrary(entries: LibraryEntry[]): Promise<void> {
  await set(INDEX_KEY, entries)
  syncIndexToCloud(entries)
}

export async function addBook(
  meta: Omit<LibraryEntry, 'currentIndex' | 'progressPct'>,
  posts: Post[],
): Promise<LibraryEntry> {
  const entry: LibraryEntry = { ...meta, currentIndex: 0, progressPct: 0 }
  const lib = await getLibrary()
  lib.unshift(entry)
  await saveLibrary(lib)
  const stored: StoredBook = { meta: entry, posts, highlights: [] }
  await set(bookKey(meta.id), stored)
  syncBookToCloud(stored)
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
    syncBookToCloud(stored)
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
  syncBookToCloud(stored)
  return nowOn
}

export async function saveChapterSummary(id: string, chapterIndex: number, summary: string): Promise<void> {
  const stored = await get<StoredBook>(bookKey(id))
  if (!stored) return
  stored.chapterSummaries = { ...(stored.chapterSummaries || {}), [chapterIndex]: summary }
  await set(bookKey(id), stored)
  syncBookToCloud(stored)
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
  syncBookToCloud(stored)
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
  syncBookToCloud(stored)
  return nowOn
}

export async function removeBook(id: string): Promise<void> {
  const lib = await getLibrary()
  await saveLibrary(lib.filter((b) => b.id !== id))
  await del(bookKey(id))
  const user = getCurrentUser()
  if (user) void deleteCloudBook(user.uid, id)
}

/** Writes a book that came FROM the cloud into local storage, without
 * pushing it right back (it's already there) — used only by
 * pullCloudLibrary below. */
async function saveStoredBookLocally(book: StoredBook): Promise<void> {
  const lib = await getLibrary()
  if (!lib.some((entry) => entry.id === book.meta.id)) {
    lib.unshift(book.meta)
    await set(INDEX_KEY, lib)
  }
  await set(bookKey(book.meta.id), book)
}

/** Pulls any books that exist in this account's cloud library but not yet
 * on this device — the "open the app on a new device and see your books"
 * side of sync. Call once, right after a sign-in is detected. Returns
 * whether anything new was pulled, so the caller knows to refresh its view
 * of the library. */
export async function pullCloudLibrary(uid: string): Promise<boolean> {
  const cloudEntries = await fetchCloudIndex(uid)
  if (cloudEntries.length === 0) return false

  const localLib = await getLibrary()
  const localIds = new Set(localLib.map((entry) => entry.id))

  let pulledAny = false
  for (const entry of cloudEntries) {
    if (localIds.has(entry.id)) continue
    const book = await fetchCloudBook(uid, entry.id)
    if (book) {
      await saveStoredBookLocally(book)
      pulledAny = true
    }
  }
  return pulledAny
}
