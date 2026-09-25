import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

// Keep in sync with the inline script in index.html, which applies the class before first paint.
const KEY = 'theme'

function stored(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(stored)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches))
    apply()
    try {
      if (theme === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, theme)
    } catch {
      // storage unavailable: the choice still applies for this visit
    }
    if (theme !== 'system') return
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
  return [theme, setTheme]
}

/** Calls `fn` whenever the resolved theme (the `dark` class on <html>) changes. */
export function onThemeChange(fn: () => void): () => void {
  const mo = new MutationObserver(fn)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => mo.disconnect()
}
