import { getFirebaseServices } from './firebase'
import type { LibraryEntry, StoredBook } from '../types'

/** The cross-device library index never carries cover images. Those can
 * be sizeable, and a shared document listing every book in the library
 * could push past Firestore's 1MB document limit with enough of them.
 * Full covers still live in each book's own document. */
export type CloudIndexEntry = Omit<LibraryEntry, 'coverDataUrl'>

async function getFirestoreRefs() {
  const services = await getFirebaseServices()
  if (!services) return null
  const { doc, getDoc, setDoc, deleteDoc } = await import('firebase/firestore')
  return { db: services.db, doc, getDoc, setDoc, deleteDoc }
}

export async function fetchCloudIndex(uid: string): Promise<CloudIndexEntry[]> {
  const fs = await getFirestoreRefs()
  if (!fs) return []
  try {
    const snap = await fs.getDoc(fs.doc(fs.db, 'users', uid, 'libraryIndex', 'index'))
    const data = snap.data()
    return Array.isArray(data?.entries) ? (data.entries as CloudIndexEntry[]) : []
  } catch (err) {
    console.error('Could not fetch the cloud library index', err)
    return []
  }
}

export async function pushCloudIndex(uid: string, entries: LibraryEntry[]): Promise<void> {
  const fs = await getFirestoreRefs()
  if (!fs) return
  const stripped: CloudIndexEntry[] = entries.map(({ coverDataUrl: _coverDataUrl, ...rest }) => rest)
  try {
    await fs.setDoc(fs.doc(fs.db, 'users', uid, 'libraryIndex', 'index'), { entries: stripped })
  } catch (err) {
    console.error('Could not sync the library index to the cloud', err)
  }
}

export async function fetchCloudBook(uid: string, bookId: string): Promise<StoredBook | null> {
  const fs = await getFirestoreRefs()
  if (!fs) return null
  try {
    const snap = await fs.getDoc(fs.doc(fs.db, 'users', uid, 'books', bookId))
    return snap.exists() ? (snap.data() as StoredBook) : null
  } catch (err) {
    console.error('Could not fetch this book from the cloud', err)
    return null
  }
}

export async function pushCloudBook(uid: string, book: StoredBook): Promise<void> {
  const fs = await getFirestoreRefs()
  if (!fs) return
  try {
    await fs.setDoc(fs.doc(fs.db, 'users', uid, 'books', book.meta.id), book)
  } catch (err) {
    // Most likely cause: this book's JSON (posts + highlights + a cover
    // image) is larger than Firestore's 1MB document limit — a very long
    // book, or a large cover. Not fatal: the book still works fine
    // locally, it just won't follow the reader to another device.
    console.error('Could not sync this book to the cloud (it may be too large)', err)
  }
}

export async function deleteCloudBook(uid: string, bookId: string): Promise<void> {
  const fs = await getFirestoreRefs()
  if (!fs) return
  try {
    await fs.deleteDoc(fs.doc(fs.db, 'users', uid, 'books', bookId))
  } catch (err) {
    console.error('Could not remove this book from the cloud', err)
  }
}
