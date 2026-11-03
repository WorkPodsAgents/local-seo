// A domain as people type it ("https://www.Acme.com/shoes", "acme.com") reduced to its lower-case
// host without "www.", so a citation, a party's domain and a DataForSEO target compare equal.

export function bareHost(input: string): string {
  const trimmed = input.trim().toLowerCase()
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
  let host: string
  try {
    host = new URL(withScheme).hostname
  } catch {
    host = trimmed.split(/[/?#]/)[0] ?? ''
  }
  return host.replace(/^www\./, '').replace(/\.$/, '')
}
