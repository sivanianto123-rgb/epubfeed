import { useCallback, useState } from 'react'
import type { StoredBook } from './types'
import { getBook } from './lib/library'
import { Home } from './components/Home'
import { Feed } from './components/Feed'

export default function App() {
  const [activeBook, setActiveBook] = useState<StoredBook | null>(null)

  const openBook = useCallback(async (id: string) => {
    const book = await getBook(id)
    if (book) setActiveBook(book)
  }, [])

  const goHome = useCallback(() => {
    setActiveBook(null)
  }, [])

  return activeBook ? <Feed book={activeBook} onBack={goHome} /> : <Home onOpenBook={openBook} />
}
