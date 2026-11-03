// Shows each result's primary category on the card itself, as Maps and Search do not. The label
// lives in a shadow root so Google's styles cannot reach inside it, and the host is a custom tag
// so Google's tag and class selectors do not match it either.
import tokens from '../../../../vendor/agent-ready/vendor/workpods/theme/tokens.css?raw'

/** A result card on the page and its primary category; null when the reader could not tell. */
export interface ResultCard {
  readonly element: Element
  readonly category: string | null
}

const HOST_TAG = 'local-seo-category'

// The tokens are declared on :root, which a shadow root cannot see from the page; on :host they
// apply inside the label without touching Google's page.
const STYLE = `${tokens.replace(/:root\s*\{/, ':host {')}
:host {
  all: initial;
  display: block;
  margin-block: var(--space-1);
}
.label {
  display: inline-block;
  padding: 0 var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent);
  font-family: var(--font-ui);
  font-size: var(--fs-caption);
  font-weight: var(--fw-medium);
  line-height: 1.6;
}
`

/**
 * Labels each card whose category is known and returns how many carry a label. Running it again
 * updates the labels in place, and a card whose category is no longer known loses its label, so a
 * label never shows a stale category.
 */
export function showCategoryLabels(cards: readonly ResultCard[]): number {
  let labelled = 0
  for (const { element, category } of cards) {
    const existing = element.querySelector(HOST_TAG)
    if (category === null) {
      existing?.remove()
      continue
    }
    const label = (existing ?? attachLabel(element)).shadowRoot?.querySelector('.label')
    if (label) label.textContent = category
    labelled += 1
  }
  return labelled
}

/** Removes every label under `root` and returns how many it removed. */
export function hideCategoryLabels(root: ParentNode): number {
  const hosts = Array.from(root.querySelectorAll(HOST_TAG))
  for (const host of hosts) host.remove()
  return hosts.length
}

function attachLabel(card: Element): Element {
  const doc = card.ownerDocument
  const host = doc.createElement(HOST_TAG)
  // Open so the label can be read back; closing it would not keep Google's CSS out any better.
  const shadow = host.attachShadow({ mode: 'open' })
  const style = doc.createElement('style')
  style.textContent = STYLE
  const label = doc.createElement('span')
  label.className = 'label'
  label.title = 'Primary category, shown by Local SEO'
  shadow.append(style, label)
  card.append(host)
  return host
}
