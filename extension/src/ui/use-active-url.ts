import { useCallback, useEffect, useState } from 'react'
import type { Browser } from 'wxt/browser'
import { demoTab } from './client'

const TABS: Browser.permissions.Permissions = { permissions: ['tabs'] }

export interface ActiveTab {
  readonly id: number
  readonly url: string
}

/**
 * The tab the user is looking at, which every screen of the panel works on. Chrome hides a tab's
 * address until the extension may read tabs or already has that site, so this is null on a fresh
 * install until the user allows tab reading (useTabAccess).
 */
export function useActiveTab(): ActiveTab | null {
  const [active, setActive] = useState<ActiveTab | null>(demoTab)
  useEffect(() => {
    if (demoTab() !== null) return
    const read = () =>
      void browser.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) =>
        setActive((current) => {
          if (tab?.id === undefined || tab.url === undefined) return null
          // A new object on every tab event would rerun every screen's effects.
          return current?.id === tab.id && current.url === tab.url
            ? current
            : { id: tab.id, url: tab.url }
        }),
      )
    read()
    browser.tabs.onActivated.addListener(read)
    browser.tabs.onUpdated.addListener(read)
    browser.permissions.onAdded.addListener(read)
    return () => {
      browser.tabs.onActivated.removeListener(read)
      browser.tabs.onUpdated.removeListener(read)
      browser.permissions.onAdded.removeListener(read)
    }
  }, [])
  return active
}

/** Whether the panel may read tab addresses, and the click handler that asks for it. */
export function useTabAccess(): { readonly granted: boolean | null; readonly allow: () => void } {
  const [granted, setGranted] = useState<boolean | null>(demoTab() === null ? null : true)
  useEffect(() => {
    if (demoTab() !== null) return
    const read = () => void browser.permissions.contains(TABS).then(setGranted)
    read()
    browser.permissions.onAdded.addListener(read)
    browser.permissions.onRemoved.addListener(read)
    return () => {
      browser.permissions.onAdded.removeListener(read)
      browser.permissions.onRemoved.removeListener(read)
    }
  }, [])
  // Must run straight from the click: Chrome shows the prompt only during the user's gesture.
  const allow = useCallback(() => void browser.permissions.request(TABS).then(setGranted), [])
  return { granted, allow }
}
