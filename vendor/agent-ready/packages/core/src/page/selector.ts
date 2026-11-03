// A CSS selector for an element, so a finding can highlight it in the live page: its id when the
// id is unique, else a tag:nth-of-type path from the nearest ancestor with a unique id.

const PLAIN_ID = /^[A-Za-z][\w-]*$/

export function selectorFor(element: Element): string {
  const steps: string[] = []
  for (let at: Element | null = element; at !== null; at = at.parentElement) {
    const id = uniqueId(at)
    if (id !== null) {
      steps.unshift(id)
      break
    }
    steps.unshift(step(at))
  }
  return steps.join(' > ')
}

function uniqueId(element: Element): string | null {
  const id = element.getAttribute('id')
  if (id === null || id === '') return null
  const selector = PLAIN_ID.test(id) ? `#${id}` : `[id="${id.replace(/["\\]/g, '\\$&')}"]`
  return element.ownerDocument.querySelectorAll(selector).length === 1 ? selector : null
}

function step(element: Element): string {
  const tag = element.localName
  if (element.parentElement === null) return tag
  let index = 1
  for (let at = element.previousElementSibling; at !== null; at = at.previousElementSibling) {
    if (at.localName === tag) index += 1
  }
  return `${tag}:nth-of-type(${index})`
}
