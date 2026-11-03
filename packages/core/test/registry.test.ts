import { describe, expect, it } from 'vitest'
import { LOCAL_CHECKS, localCheck, localThreshold } from '../src/registry'

describe('the local check registry', () => {
  it('given the JSON, then every check has an id L<n> in order, a rubric and a fix', () => {
    const ids = [...LOCAL_CHECKS.keys()]
    expect(ids).toEqual(ids.map((_, at) => `L${at + 1}`))
    for (const check of LOCAL_CHECKS.values()) {
      expect(check.rubric.length).toBeGreaterThan(20)
      expect(check.fix.length).toBeGreaterThan(20)
    }
  })

  it('when an unknown id or threshold is asked for, then it throws', () => {
    expect(() => localCheck('L999')).toThrow('unknown local check id: L999')
    expect(() => localThreshold('L1', 'min')).toThrow('unknown threshold min')
    expect(localThreshold('L12', 'max')).toBe(750)
  })
})
