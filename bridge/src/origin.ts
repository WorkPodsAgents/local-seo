import { EXTENSION_ORIGIN } from '@local-seo/core/bridge'

/** Firefox gives each installation its own UUID; trust only the origin its owner supplies. */
export function bridgeOrigin(configured: string | undefined): string {
  if (configured === undefined) return EXTENSION_ORIGIN
  if (
    !/^moz-extension:\/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      configured,
    )
  ) {
    throw new Error('LOCAL_SEO_EXTENSION_ORIGIN must be the exact Firefox extension origin')
  }
  return configured
}
