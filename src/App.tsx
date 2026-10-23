import { useCallback, useState } from 'react'
import type { StoredBook } from './types'
import { getBook } from './lib/library'
import { Home } from './components/Home'
import { Feed } from './components/Feed'
import { AboutPage, FaqPage, FormatsPage } from './components/Pages'

type StaticPageId = 'formats' | 'about' | 'faq'

export default function App() {
  const [activeBook, setActiveBook] = useState<StoredBook | null>(null)
  const [page, setPage] = useState<StaticPageId | null>(null)

  const openBook = useCallback(async (id: string) => {
    const book = await getBook(id)
    if (book) setActiveBook(book)
  }, [])

  const goHome = useCallback(() => {
    setActiveBook(null)
    setPage(null)
  }, [])

  if (activeBook) {
    return <Feed book={activeBook} onBack={goHome} />
  }

  if (page === 'formats') return <FormatsPage onBack={goHome} />
  if (page === 'about') return <AboutPage onBack={goHome} />
  if (page === 'faq') return <FaqPage onBack={goHome} />

  return <Home onOpenBook={openBook} onNavigate={setPage} />
}
