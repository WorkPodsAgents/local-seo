import { describe, expect, it } from 'vitest'
import { originPattern } from '../../src/background/host-access'

describe('website permission origin', () => {
  it('matches a granted site even when its server uses a non-default port', () => {
    expect(originPattern('http://127.0.0.1:55000/business')).toBe('http://127.0.0.1/*')
    expect(originPattern('https://example.com:8443/contact')).toBe('https://example.com/*')
  })
  it('preserves the requested scheme and exact hostname', () => {
    expect(originPattern('https://shop.example.com/path?q=1')).toBe('https://shop.example.com/*')
  })
})
