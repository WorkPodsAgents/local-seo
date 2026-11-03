import { useEffect, useState } from 'react'
import { inEnglish, languageName, readsAsEnglish } from '../readers/maps/language'
import { askTab } from '../readers/tab-client'
import { demoTab } from './client'
import { Button } from './components/button'
import { Empty } from './components/notice'
import type { ActiveTab } from './use-active-url'

const MAPS = /^https:\/\/www\.google\.[a-z.]+\/maps(\/|$|\?)/

/**
 * The language of the Maps page in `tab`, or null off Maps, before it answers, or when it cannot
 * be read. It is asked again only when the tab, the site or its `hl` changes: Maps rewrites its
 * address on every pan, while its language changes only with a reload.
 */
export function useMapsLanguage(tab: ActiveTab | null): string | null {
  const [language, setLanguage] = useState<string | null>(null)
  const onMaps = tab !== null && MAPS.test(tab.url) && demoTab() === null
  const key = onMaps ? `${tab.id} ${hostAndHl(tab.url)}` : null
  useEffect(() => {
    setLanguage(null)
    if (!onMaps) return
    let current = true
    askTab(tab, 'maps:language', {})
      .then((answer) => current && setLanguage(answer.language))
      .catch(() => undefined)
    return () => {
      current = false
    }
    // The key holds everything in the tab that can change the answer.
  }, [key])
  return language
}

function hostAndHl(url: string): string {
  const parsed = new URL(url)
  return `${parsed.host} ${parsed.searchParams.get('hl') ?? ''}`
}

/** Shown while the Maps tab is in another language: some readers match Maps' English words. */
export function LanguageNotice({ tab, language }: { tab: ActiveTab; language: string | null }) {
  if (language === null || readsAsEnglish(language)) return null
  const reopen = () => void browser.tabs.update(tab.id, { url: inEnglish(tab.url) })
  return (
    <Empty
      title="Local SEO reads Google Maps in English for now"
      action={
        <Button variant="primary" onClick={reopen}>
          Reopen this page in English
        </Button>
      }
    >
      This Maps page is in {languageName(language)}, so some details, such as the photo count,
      opening hours and whether the profile is claimed, may come back missing. Reopen it in English
      with the button, or switch Google&apos;s language to English (in Google Maps, open the menu,
      choose Language and pick English) for complete results.
    </Empty>
  )
}
