import { useEffect, useState } from 'react'

export type View = 'meadow' | 'evolution' | 'guide'

export const hrefOf = (v: View) => (v === 'meadow' ? '#/' : `#/${v}`)

function viewFromHash(): View {
  const h = window.location.hash.replace(/^#\/?/, '')
  return h === 'evolution' || h === 'guide' ? h : 'meadow'
}

/** The current page, kept in the URL hash so browser back and links work without a router. */
export function useView(): [View, (v: View) => void] {
  const [view, setView] = useState(viewFromHash)
  useEffect(() => {
    // Back/forward to an entry whose query also differs fires popstate but not hashchange.
    const on = () => setView(viewFromHash())
    window.addEventListener('hashchange', on)
    window.addEventListener('popstate', on)
    return () => {
      window.removeEventListener('hashchange', on)
      window.removeEventListener('popstate', on)
    }
  }, [])
  return [view, (v) => { if (v !== viewFromHash()) window.location.hash = hrefOf(v) }]
}
