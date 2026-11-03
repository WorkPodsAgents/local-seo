import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { awaitAnswer, fillPrompt } from '../../src/answers/assist'
import { engineFor } from '../../src/answers/engines'

// Saved assistant pages from Agent Ready's reader tests, trimmed to the parts the readers use.
const fixture = (name: string): Document =>
  parseHTML(readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8'))
    .document as unknown as Document

const page = (body: string): Document =>
  parseHTML(`<!doctype html><html><body>${body}</body></html>`).document as unknown as Document

function read(url: string, doc: Document) {
  const engine = engineFor(url)
  if (engine === null) throw new Error(`no engine for ${url}`)
  return engine.read(doc, url)
}

describe('which assistant a tab is', () => {
  it('picks the reader from the address, Google AI Mode only with udm=50', () => {
    expect(engineFor('https://chatgpt.com/c/1')?.id).toBe('chatgpt')
    expect(engineFor('https://gemini.google.com/app/1')?.id).toBe('gemini')
    expect(engineFor('https://www.perplexity.ai/search/x')?.id).toBe('perplexity')
    expect(engineFor('https://www.google.co.uk/search?q=x&udm=50')?.id).toBe('ai_mode')
    expect(engineFor('https://www.google.com/search?q=x')).toBeNull()
    expect(engineFor('https://www.google.evil.com/search?q=x&udm=50')).toBeNull()
  })
})

describe('answer readers', () => {
  it('ChatGPT: the newest answer with its prompt and sources', () => {
    const answer = read('https://chatgpt.com/c/abc', fixture('chatgpt.html'))
    expect(answer?.prompt).toBe('Best running shoes for flat feet?')
    expect(answer?.text).toContain('Acme Running Arch Pro')
    expect(answer?.text).not.toContain('older answer')
    expect(answer?.citations.map((c) => c.url)).toEqual([
      'https://stride.example/guide-9',
      'https://www.acmerunning.example/arch-pro',
      'https://reviews.example/flat-feet-shoes',
    ])
    expect(answer?.streaming).toBe(false)
  })

  it('Gemini: unwraps Google redirects and drops Google help links', () => {
    const answer = read('https://gemini.google.com/app/1', fixture('gemini.html'))
    expect(answer?.citations).toEqual([
      { url: 'https://runnersguide.example/marathon-shoes', title: 'this guide' },
      { url: 'https://pacershoes.example/long-run', title: 'Pacer Shoes: Long Run' },
    ])
  })

  it('Perplexity: the answer and the sources strip once each', () => {
    const answer = read('https://www.perplexity.ai/search/x', fixture('perplexity.html'))
    expect(answer?.citations.map((c) => c.url)).toEqual([
      'https://shoeshop.example/running',
      'https://acmerunning.example/shop',
    ])
  })

  it('AI Mode: the latest turn and the prompt box', () => {
    const url = 'https://www.google.com/search?q=lightest+racing+flats&udm=50'
    const answer = read(url, fixture('google-ai-mode.html'))
    expect(answer?.text).toContain('Pacer Shoes Dash is the lightest at 160 grams.')
    expect(engineFor(url)?.promptInput(fixture('google-ai-mode.html'))?.tagName).toBe('TEXTAREA')
  })
})

describe('Assist mode', () => {
  it('fills the prompt box and never submits or clicks send', () => {
    const doc = page('<form><textarea></textarea><button type="submit">Send</button></form>')
    let sent = 0
    doc.querySelector('form')?.addEventListener('submit', () => (sent += 1))
    doc.querySelector('button')?.addEventListener('click', () => (sent += 1))
    const input = doc.querySelector('textarea') as unknown as HTMLTextAreaElement
    fillPrompt(input, 'What is the best plumber in West Nyack, NY?')
    expect(input.value).toBe('What is the best plumber in West Nyack, NY?')
    expect(sent).toBe(0)
  })

  it('waits past the old answer until the new one stops streaming', async () => {
    const url = 'https://www.perplexity.ai/search/x'
    const engine = engineFor(url)
    if (engine === null) throw new Error('no Perplexity reader')
    const turn = (text: string, busy: boolean) =>
      `<div id="markdown-content-1">${text}</div>${busy ? '<button aria-label="Stop">' : ''}`
    const doc = page(turn('Old answer.', false))
    const frames = [turn('Rockland', true), turn('Rockland Rooter.', false)]
    let poll = 0
    const answer = await awaitAnswer(doc, engine, () => url, {
      before: 'Old answer.',
      quietMs: 1000,
      timeoutMs: 10_000,
      pollMs: 500,
      sleep: async () => {
        doc.body.innerHTML = frames[Math.min(poll, frames.length - 1)] ?? ''
        poll += 1
      },
    })
    expect(answer?.text).toBe('Rockland Rooter.')
  })
})
