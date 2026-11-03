import { useState } from 'react'
import { Button } from './components/button'

/** Copies `text` and says so for a moment; the user pastes drafts and ids into Google. */
export function CopyButton({
  text,
  label = 'Copy',
  what,
}: {
  readonly text: string
  readonly label?: string
  /** Names what is copied for a screen reader when the button sits beside it, such as "CID". */
  readonly what?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      aria-label={what === undefined ? undefined : `${label} ${what}`}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  )
}
