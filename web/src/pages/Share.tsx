import { useSearch } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { Redirect } from '../components/Redirect'
import { useToast } from '../lib/toast'
import { sharedWish } from '../lib/wishlist'

/**
 * Where the phone's Share menu lands. Picks the link out of what the other app sent and
 * opens the add sheet on Your list with it; the page is read in the background as usual.
 */
export function SharePage() {
  const search = useSearch({ from: '/app/share' })
  const found = sharedWish(search)
  const toast = useToast()
  const told = useRef(false)
  useEffect(() => {
    if (found || told.current) return
    told.current = true
    toast('Nothing to add: what you shared had no link. Share the product page from the store.')
  }, [found, toast])
  return <Redirect to="/" search={found ? { add: found.url, name: found.title ?? undefined } : {}} />
}
