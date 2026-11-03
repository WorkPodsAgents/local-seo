// The parts of a Google Maps page that the place, review and post readers share: the open place's
// panel, the list inside it that scrolls, and the "limited view" Google shows signed-out users.
// Hooks are roles, aria labels and data attributes; Maps renames its class names every release.

/** The open place's panel: the `main` region named after the place, not the results list. */
export function placePanel(doc: Document): Element | null {
  for (const main of Array.from(doc.querySelectorAll('[role="main"][aria-label]'))) {
    if (main.querySelector('[role="feed"]') === null) return main
  }
  return null
}

/**
 * Whether Maps is showing its limited view, where a signed-out user sees a handful of reviews and
 * no posts tab. Google words the banner only in text, so this matches the English wording.
 */
export function isLimitedView(doc: Document): boolean {
  return /limited view of Google Maps/i.test(doc.body?.textContent ?? '')
}

/**
 * The part of the place panel that scrolls and holds `item`. The panel's header is one child and
 * the scrolling body the other, so it is the item's ancestor that sits directly in the panel.
 */
export function panelScroller(panel: Element, item: Element): Element | null {
  let node: Element | null = item
  while (node !== null && node.parentElement !== panel) node = node.parentElement
  return node
}

// Maps draws its icons as Google Symbols glyphs from the Unicode private use area.
const ICON_GLYPHS = /[\ue000-\uf8ff]/g

/** Text a person reads: icon glyphs and duplicates hidden from screen readers left out. */
export function visibleText(node: Node): string {
  if (node.nodeType === 3) return (node.textContent ?? '').replace(ICON_GLYPHS, '')
  if (node.nodeType !== 1) return ''
  const element = node as Element
  if (element.getAttribute('aria-hidden') === 'true') return ''
  return Array.from(element.childNodes).map(visibleText).join('')
}

/** Collapses runs of whitespace, including the narrow no-break space Maps puts before "AM". */
export function squash(text: string): string {
  return text.replace(/[\s  ]+/g, ' ').trim()
}

/** "1,734" or "1.734" as 1734; null when the text holds no whole number. */
export function countIn(text: string): number | null {
  const match = /\d[\d,.  ]*/.exec(text)
  if (match === null) return null
  const digits = match[0].replace(/\D/g, '')
  return digits === '' ? null : Number(digits)
}

/** A star rating such as "4.7" or "4,7" from the start of a label; null for whole-star counts. */
export function ratingIn(label: string): number | null {
  const match = /^\s*(\d)[.,](\d)/.exec(label)
  return match === null ? null : Number(`${match[1]}.${match[2]}`)
}
