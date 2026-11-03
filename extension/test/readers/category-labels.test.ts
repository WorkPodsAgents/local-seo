import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import {
  hideCategoryLabels,
  showCategoryLabels,
  type ResultCard,
} from '../../src/readers/overlay/category-labels'

function page(): { document: Document; cards: Element[] } {
  const { document } = parseHTML(
    '<html><body><div class="feed">' +
      '<div class="card">Joe’s Pizza</div><div class="card">Luigi’s</div>' +
      '<div class="card">Unknown place</div></div></body></html>',
  )
  return { document, cards: Array.from(document.querySelectorAll('.card')) }
}

function labelsOn(card: Element): string[] {
  return Array.from(card.querySelectorAll('local-seo-category')).map(
    (host) => host.shadowRoot?.querySelector('.label')?.textContent ?? '',
  )
}

function withCategories(cards: Element[], categories: (string | null)[]): ResultCard[] {
  return cards.map((element, i) => ({ element, category: categories[i] ?? null }))
}

describe('the category overlay on result cards', () => {
  it('labels each card whose category is known, inside a shadow root', () => {
    const { cards } = page()
    const labelled = showCategoryLabels(withCategories(cards, ['Pizza restaurant', 'Bakery']))
    expect(labelled).toBe(2)
    expect(cards.map(labelsOn)).toEqual([['Pizza restaurant'], ['Bakery'], []])
    expect(cards[0]?.textContent).toBe('Joe’s Pizza')
  })

  it('styles the label from the WorkPods tokens, declared on the shadow host', () => {
    const { cards } = page()
    showCategoryLabels(withCategories(cards, ['Pizza restaurant']))
    const style = cards[0]?.querySelector('local-seo-category')?.shadowRoot?.querySelector('style')
    expect(style?.textContent).toMatch(/:host \{[^}]*--accent-soft:/)
    expect(style?.textContent).not.toMatch(/:root\s*\{/)
  })

  it('updates labels in place when shown again, without adding a second one', () => {
    const { cards } = page()
    showCategoryLabels(withCategories(cards, ['Pizza restaurant', 'Bakery']))
    showCategoryLabels(withCategories(cards, ['Pizza delivery', 'Bakery']))
    expect(cards.map(labelsOn)).toEqual([['Pizza delivery'], ['Bakery'], []])
  })

  it('drops a label when the category is no longer known', () => {
    const { cards } = page()
    showCategoryLabels(withCategories(cards, ['Pizza restaurant', 'Bakery']))
    expect(showCategoryLabels(withCategories(cards, [null, 'Bakery']))).toBe(1)
    expect(cards.map(labelsOn)).toEqual([[], ['Bakery'], []])
  })

  it('removes every label on hide and leaves the cards as they were', () => {
    const { document, cards } = page()
    const before = document.body.innerHTML
    showCategoryLabels(withCategories(cards, ['Pizza restaurant', 'Bakery', 'Cafe']))
    expect(hideCategoryLabels(document)).toBe(3)
    expect(document.body.innerHTML).toBe(before)
    expect(hideCategoryLabels(document)).toBe(0)
  })
})
