import { NO_HOST_ACCESS } from '@local-seo/core/bridge'
import { SITE_PERMISSIONS } from '../shared/host'

/** The origin pattern a host permission is granted for. */
export function originPattern(url: string): string {
  const parsed = new URL(url)
  // WebExtension host grants cover every port; Firefox does not match a port-qualified pattern.
  return `${parsed.protocol}//${parsed.hostname}/*`
}

/**
 * Network work runs only on sites the user granted. The panel asks for the grant when the user
 * starts the work; the bridge cannot ask, so it gets a message saying where to grant it.
 */
export async function requireHostAccess(url: string): Promise<void> {
  const wanted = { permissions: [...SITE_PERMISSIONS], origins: [originPattern(url)] }
  if (await browser.permissions.contains(wanted)) return
  throw new Error(
    `${NO_HOST_ACCESS} ${new URL(url).host} yet. To allow it, open the Local SEO ` +
      'side panel, go to the Website tab, press Check website, and choose Allow when the browser ' +
      'asks.',
  )
}
