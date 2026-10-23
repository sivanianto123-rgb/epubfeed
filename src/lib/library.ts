import { get, set, del } from 'idb-keyval'
import type { LibraryEntry, StoredBook, Post } from '../types'

const INDEX_KEY = 'epubfeed:index'
const bookKey = (id: string) => `epubfeed:book:${id}`

export async function getLibrary(): Promise<LibraryEntry[]> {
  return (await get(INDEX_KEY)) || []
}

async function saveLibrary(entries: LibraryEntry[]): Promise<void> {
  await set(INDEX_KEY, entries)
}

export async function addBook(
  meta: Omit<LibraryEntry, 'currentIndex'>,
  posts: Post[],
): Promise<LibraryEntry> {
  const entry: LibraryEntry = { ...meta, currentIndex: 0 }
  const lib = await getLibrary()
  lib.unshift(entry)
  await saveLibrary(lib)
  await set(bookKey(meta.id), { meta: entry, posts } as StoredBook)
  return entry
}

export async function getBook(id: string): Promise<StoredBook | undefined> {
  return await get(bookKey(id))
}

export async function updateProgress(id: string, currentIndex: number): Promise<void> {
  const lib = await getLibrary()
  const idx = lib.findIndex((b) => b.id === id)
  if (idx >= 0) {
    lib[idx] = { ...lib[idx], currentIndex }
    await saveLibrary(lib)
  }
  const stored = await get<StoredBook>(bookKey(id))
  if (stored) {
    stored.meta.currentIndex = currentIndex
    await set(bookKey(id), stored)
  }
}

export async function removeBook(id: string): Promise<void> {
  const lib = await getLibrary()
  await saveLibrary(lib.filter((b) => b.id !== id))
  await del(bookKey(id))
}
