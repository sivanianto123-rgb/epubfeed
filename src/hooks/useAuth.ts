import { useEffect, useState } from 'react'
import { getCurrentUser, subscribeToAuth, type User } from '../lib/auth'

export function useAuth(): User | null {
  const [user, setUser] = useState<User | null>(() => getCurrentUser())
  useEffect(() => subscribeToAuth(setUser), [])
  return user
}
