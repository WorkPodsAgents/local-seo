/** The host without a leading www., which is how people name their site. */
export function bareHost(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '')
}

/**
 * The grant a check asks for: the site and its subdomains on any scheme, so the common redirects
 * (http to https, apex to www) stay inside what the user allowed.
 */
export function sitePattern(url: string): string {
  return `*://*.${bareHost(url)}/*`
}

/** API permissions asked for with each site grant: webRequest reads the redirects of a check. */
export const SITE_PERMISSIONS = ['webRequest'] as const
