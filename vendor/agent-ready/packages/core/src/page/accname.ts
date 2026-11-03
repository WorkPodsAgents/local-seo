// Accessible names, by the basics of the W3C accname rules: what agents and screen readers call a
// button, link or field. WorkPods reads these from Lighthouse's button-name, link-name and label
// audits; the extension computes them from the page itself.
import { collapse } from './dom'
import { labelText } from './webmcp'

const CONTROLS = 'a[href], button, input, select, textarea, [role="button"], [role="link"]'
const NEVER_SHOWN = new Set(['template', 'noscript', 'script', 'style', 'head'])
const STYLE_HIDDEN = /display\s*:\s*none|visibility\s*:\s*hidden/i

/** Controls a visitor can see whose accessible name is empty, in document order. */
export function unlabelledControls(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll(CONTROLS)).filter(
    (control) =>
      !(control.localName === 'input' && inputType(control) === 'hidden') &&
      rendersToUser(control) &&
      accessibleName(control) === '',
  )
}

function rendersToUser(element: Element): boolean {
  for (let at: Element | null = element; at !== null; at = at.parentElement) {
    if (NEVER_SHOWN.has(at.localName) || at.hasAttribute('hidden')) return false
    if (at.getAttribute('aria-hidden') === 'true') return false
    if (STYLE_HIDDEN.test(at.getAttribute('style') ?? '')) return false
  }
  return true
}

function inputType(input: Element): string {
  return (input.getAttribute('type') ?? 'text').trim().toLowerCase()
}

export function accessibleName(element: Element): string {
  const labelledBy = (element.getAttribute('aria-labelledby') ?? '')
    .split(/\s+/)
    .filter((id) => id !== '')
    .map((id) => element.ownerDocument.getElementById(id))
    .map((target) => (target === null ? '' : contentName(target)))
    .join(' ')
  return (
    first(labelledBy, element.getAttribute('aria-label')) ??
    first(...ownNames(element), element.getAttribute('title')) ??
    first(fieldOnly(element, element.getAttribute('placeholder'))) ??
    ''
  )
}

/** What the element's own kind names it by: its label, its alt, its value, or its content. */
function ownNames(element: Element): (string | null)[] {
  switch (element.localName) {
    case 'input':
      return inputNames(element)
    case 'select':
    case 'textarea':
      return [labelOf(element)]
    default:
      return [contentName(element)]
  }
}

function inputNames(input: Element): (string | null)[] {
  const type = inputType(input)
  if (type === 'image') return [labelOf(input), input.getAttribute('alt')]
  // A submit or reset button with no value shows the browser's own word.
  if (type === 'submit') return [labelOf(input), input.getAttribute('value') ?? 'Submit']
  if (type === 'reset') return [labelOf(input), input.getAttribute('value') ?? 'Reset']
  if (type === 'button') return [labelOf(input), input.getAttribute('value')]
  return [labelOf(input)]
}

function fieldOnly(element: Element, value: string | null): string | null {
  return ['input', 'textarea'].includes(element.localName) ? value : null
}

/** A `<label for>` naming the field, else a label wrapping it. */
function labelOf(field: Element): string | null {
  const id = field.getAttribute('id')
  const doc = field.ownerDocument
  const byFor =
    id === null
      ? []
      : Array.from(doc.querySelectorAll('label[for]')).filter(
          (label) => label.getAttribute('for') === id,
        )
  const wrapping = field.closest('label')
  const labels = wrapping === null ? byFor : [...byFor, wrapping]
  return labels.map(labelText).join(' ')
}

/** The name an element's content gives it: its text, the alt of its images, an SVG's title. */
function contentName(node: Node): string {
  const parts: string[] = []
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) parts.push(child.textContent ?? '')
    if (child.nodeType !== 1) continue
    const element = child as Element
    if (element.getAttribute('aria-hidden') === 'true' || NEVER_SHOWN.has(element.localName)) {
      continue
    }
    const label = element.getAttribute('aria-label')?.trim()
    if (label) parts.push(label)
    else if (element.localName === 'img') parts.push(element.getAttribute('alt') ?? '')
    else if (element.localName === 'svg') parts.push(svgTitle(element))
    else parts.push(contentName(element))
  }
  return collapse(parts.join(' '))
}

function svgTitle(svg: Element): string {
  const title = Array.from(svg.children).find((child) => child.localName === 'title')
  return title?.textContent ?? ''
}

function first(...names: (string | null | undefined)[]): string | null {
  for (const name of names) {
    const text = collapse(name ?? '')
    if (text !== '') return text
  }
  return null
}
