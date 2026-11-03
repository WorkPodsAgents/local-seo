import { describe, expect, it } from 'vitest'
import { answerVisibility } from '../src/ai'

const ANSWER = [
  'Here are the best plumbers in West Nyack, NY:',
  '1. **Rockland Rooter** - fast emergency service.',
  '2. **Nyack Plumbing Co** - licensed, upfront prices.',
  '3. **Hudson Pipes**: good reviews.',
  '4. **Tappan Drains** (24/7).',
].join('\n')

describe('local AI visibility of one answer', () => {
  it('given the business second in the list, then it is recommended at position 2', () => {
    const verdict = answerVisibility({
      text: ANSWER,
      citedUrls: ['https://yelp.example/a', 'https://yelp.example/a'],
      businessName: 'Nyack Plumbing Co',
      competitors: ['Hudson Pipes', 'Absent Plumbing'],
    })
    expect(verdict.verdict).toBe('recommended')
    expect(verdict.position).toBe(2)
    expect(verdict.businessesNamed).toEqual([
      'Rockland Rooter',
      'Nyack Plumbing Co',
      'Hudson Pipes',
      'Tappan Drains',
    ])
    expect(verdict.competitorsNamed).toEqual(['Hudson Pipes'])
    expect(verdict.excerpt).toContain('Nyack Plumbing Co')
    expect(verdict.citedUrls).toEqual(['https://yelp.example/a'])
  })

  it('when it is named fourth, then it is named, not recommended', () => {
    const verdict = answerVisibility({
      text: ANSWER,
      citedUrls: [],
      businessName: 'Tappan Drains',
      competitors: [],
    })
    expect(verdict).toMatchObject({ verdict: 'named', position: 4 })
  })

  it('when the answer never names it, then it is absent with the opening as excerpt', () => {
    const verdict = answerVisibility({
      text: ANSWER,
      citedUrls: [],
      businessName: 'Valley Plumbing',
      competitors: [],
    })
    expect(verdict).toMatchObject({ verdict: 'absent', position: null })
    expect(verdict.excerpt.startsWith('Here are the best plumbers')).toBe(true)
  })

  it('given a name inside another word, then it does not count as named', () => {
    const verdict = answerVisibility({
      text: 'The best place to buy tools is **Space Age Hardware**.',
      citedUrls: [],
      businessName: 'Ace',
      competitors: ['Age'],
    })
    expect(verdict).toMatchObject({ verdict: 'absent', position: null })
    expect(verdict.businessesNamed).toEqual(['Space Age Hardware'])
    expect(verdict.competitorsNamed).toEqual(['Age'])
  })
})
