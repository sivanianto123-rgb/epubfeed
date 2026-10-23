import type { BookReview } from './types'

const ENDPOINT = 'https://api.hardcover.app/v1/graphql'

/**
 * Hardcover's API is in beta and its schema has changed before (see
 * https://docs.hardcover.app/api/getting-started). This query shape is a
 * best-effort guess based on their docs at the time this was written —
 * once you have a real token, open their GraphQL playground and verify
 * the `search` / `books` / review field names still match. If this query
 * fails, we log it and return no reviews rather than breaking the feed.
 */
const QUERY = `
  query SearchBookReviews($q: String!) {
    search(query: $q, query_type: "Book", per_page: 1) {
      results
    }
  }
`

export async function fetchHardcoverReviews(title: string, author: string): Promise<BookReview[]> {
  const token = process.env.HARDCOVER_API_TOKEN
  if (!token) return []

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({ query: QUERY, variables: { q: `${title} ${author}`.trim() } }),
    })
    if (!res.ok) {
      console.error('Hardcover API error', res.status, await res.text().catch(() => ''))
      return []
    }
    const json = (await res.json()) as { errors?: unknown }
    if (json.errors) {
      console.error('Hardcover GraphQL errors', JSON.stringify(json.errors))
      return []
    }

    // TODO: the actual result shape needs verifying against a live response
    // — Hardcover's `search` endpoint returns a provider-specific payload
    // (their docs show it proxying Typesense) rather than a typed GraphQL
    // object, so this almost certainly needs adjusting once you can see
    // real output. Returning [] until then rather than guessing at a shape.
    return []
  } catch (err) {
    console.error('Hardcover fetch failed', err)
    return []
  }
}
