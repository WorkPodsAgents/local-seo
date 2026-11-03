import { Button } from './components/button'
import { Empty } from './components/notice'

/**
 * Chrome hides the address of the page in front of the user until the extension may read tabs, so
 * a fresh install cannot tell which business is open. One click allows it for good.
 */
export function TabAccess({ onAllow }: { readonly onAllow: () => void }) {
  return (
    <Empty
      title="Let the panel follow your tabs"
      action={
        <Button variant="primary" onClick={onAllow}>
          Allow
        </Button>
      }
    >
      Chrome hides which page you are on until you allow it. Local SEO reads the address only to
      know which business to check, and it never leaves your browser. Chrome will call this reading
      your browsing history.
    </Empty>
  )
}
