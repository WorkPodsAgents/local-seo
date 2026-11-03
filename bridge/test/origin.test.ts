import { describe, expect, it } from 'vitest'
import { EXTENSION_ORIGIN } from '@local-seo/core/bridge'
import { bridgeOrigin } from '../src/origin'

describe('bridge origin', () => {
  it('trusts the Chrome store identity by default', () => {
    expect(bridgeOrigin(undefined)).toBe(EXTENSION_ORIGIN)
  })
  it('trusts exactly the Firefox installation configured by its owner', () => {
    const origin = 'moz-extension://12345678-1234-1234-1234-123456789abc'
    expect(bridgeOrigin(origin)).toBe(origin)
  })
  it.each([
    '*',
    'null',
    'https://example.com',
    'moz-extension://*',
    'moz-extension://12345678-1234-1234-1234-123456789abc/path',
    'moz-extension://12345678-1234-1234-1234-123456789abc.attacker.com',
  ])('rejects a page, wildcard or non-origin: %s', (origin) => {
    expect(() => bridgeOrigin(origin)).toThrow('exact Firefox extension origin')
  })
})
