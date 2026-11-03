import { describe, expect, it } from 'vitest'
import { missing } from '../src/business'
import { draftPrompt, fitDraft, servicesOf } from '../src/writers'
import { aBusiness, aReview } from './business'

describe('AI writer prompts', () => {
  it('given a profile, then the description prompt carries its facts and the limit', () => {
    const prompt = draftPrompt({ kind: 'description', business: aBusiness() })
    expect(prompt.maxChars).toBe(750)
    expect(prompt.user).toContain('- Name: Nyack Plumbing Co')
    expect(prompt.user).toContain('- Primary category: Plumber')
    expect(prompt.user).toContain('- Services listed: Drain cleaning')
    expect(prompt.system).toContain('Never invent prices')
  })

  it('when a fact was not read, then the prompt leaves it out rather than guess', () => {
    const prompt = draftPrompt({
      kind: 'post',
      business: aBusiness({ services: missing('not shown'), hours: missing('not shown') }),
      topic: 'winter boiler checks',
    })
    expect(prompt.user).not.toContain('Services listed')
    expect(prompt.user).not.toContain('Hours')
    expect(prompt.user).toContain('Topic: winter boiler checks')
    expect(prompt.maxChars).toBe(1500)
  })

  it('a reply is grounded in the review, and refuses without one', () => {
    const review = aReview({ rating: 1, text: 'Nobody came.', ownerReply: null })
    const prompt = draftPrompt({ kind: 'review_reply', business: aBusiness(), review })
    expect(prompt.user).toContain('- Rating: 1 of 5')
    expect(prompt.user).toContain('- Text: Nobody came.')
    expect(() => draftPrompt({ kind: 'review_reply', business: aBusiness() })).toThrow()
  })
})

describe('fitting a draft', () => {
  it('cuts a long answer at the last sentence that fits', () => {
    const text = `${'A plumber in Nyack. '.repeat(50)}`
    const fitted = fitDraft(text, 750)
    expect(fitted.length).toBeLessThanOrEqual(750)
    expect(fitted.endsWith('.')).toBe(true)
  })

  it('strips a label and quotes the model added', () => {
    expect(fitDraft('Here is the description:\n"We fix leaks."', 750)).toBe('We fix leaks.')
  })

  it('reads a services answer as distinct names', () => {
    expect(servicesOf('1. Drain cleaning\n- Leak detection\n\n* drain cleaning\nBoilers')).toEqual([
      'Drain cleaning',
      'Leak detection',
      'Boilers',
    ])
  })
})
