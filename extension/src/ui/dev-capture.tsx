// Development builds only: saves the open Google page as a reader fixture. Reader tests run on
// pages the owner saved from their own browsing, never on pages the project fetches.
import { useState } from 'react'
import { askTab } from '../readers/tab-client'
import { Button } from './components/button'
import { ErrorNote, Note } from './components/notice'

export function DevCapture() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const capture = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
      if (tab?.id === undefined || tab.url === undefined) throw new Error('No readable tab.')
      const page = await askTab({ id: tab.id, url: tab.url }, 'dev:captureFixture', {})
      const name = fixtureName(page.url, page.capturedAt)
      save(name, JSON.stringify(page))
      setMessage(`Saved ${name} to your downloads folder.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <Button busy={busy} onClick={() => void capture()}>
        Capture this page as a fixture
      </Button>
      {message === null ? null : <Note>{message}</Note>}
      {error === null ? null : <ErrorNote>{error}</ErrorNote>}
    </div>
  )
}

function fixtureName(url: string, capturedAt: string): string {
  const { pathname } = new URL(url)
  const kind = pathname.startsWith('/maps/place')
    ? 'maps-place'
    : pathname.startsWith('/maps')
      ? 'maps-results'
      : 'search'
  return `local-seo-${kind}-${capturedAt.replace(/[:.]/g, '-')}.json`
}

// An anchor download needs no downloads permission, which the release build would never use.
function save(name: string, json: string): void {
  const href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(href)
}
