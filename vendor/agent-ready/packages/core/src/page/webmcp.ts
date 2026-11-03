// A page's declarative WebMCP tools as Chrome reads them (WebMcpForms.kt, DeclaredTools.kt): each
// visible `<form toolname>`, its `tooldescription` and `toolautosubmit`, and the named fields it
// submits. Their text is the site's: data, never instructions.
import { collapse, isShown } from './dom'
import { selectorFor } from './selector'

/** One named field of a declared tool; a radio group is one field. */
export interface ToolParam {
  readonly name: string
  /** The input's type (text, email, checkbox), or select or textarea. */
  readonly type: string
  readonly required: boolean
  /** A select's or radio group's values; else empty. */
  readonly options: readonly string[]
  /**
   * A radio group's common fieldset `toolparamdescription`, else its own
   * `toolparamdescription`, associated `<label>` or `aria-description`. Null when none.
   */
  readonly description: string | null
}

export interface DeclaredTool {
  readonly name: string
  /** Null when absent or blank: an incomplete declaration Chrome does not register. */
  readonly description: string | null
  /** Whether the agent's call submits the form. */
  readonly autoSubmit: boolean
  readonly params: readonly ToolParam[]
  /** It has a description and every field has one. */
  readonly complete: boolean
  readonly selector: string
}

/** Hidden fields and buttons are no parameters. */
const NOT_PARAMS = new Set(['hidden', 'submit', 'button', 'reset', 'image'])
const TEXT_CHARS = 500

export function declaredTools(doc: Document): DeclaredTool[] {
  const labels = labelsById(doc)
  return Array.from(doc.querySelectorAll('form[toolname]'))
    .filter(isShown)
    .flatMap((form) => {
      const tool = toolOf(form, labels)
      return tool === null ? [] : [tool]
    })
}

function toolOf(form: Element, labels: ReadonlyMap<string, string>): DeclaredTool | null {
  const name = text(form.getAttribute('toolname'))
  if (name === null) return null
  const byName = new Map<string, { param: ToolParam; group: string | null }[]>()
  for (const field of Array.from(form.querySelectorAll('input, select, textarea'))) {
    if (!isShown(field)) continue
    const param = paramOf(field, labels)
    if (param === null) continue
    const same = byName.get(param.name) ?? []
    same.push({ param, group: groupOf(field, form) })
    byName.set(param.name, same)
  }
  const params = [...byName.values()].map(merged)
  const description = text(form.getAttribute('tooldescription'))
  return {
    name,
    description,
    autoSubmit: form.hasAttribute('toolautosubmit'),
    params,
    complete: description !== null && params.every((param) => param.description !== null),
    selector: selectorFor(form),
  }
}

/**
 * A field's controls as one parameter. A group of controls (a radio group) takes the fieldset
 * description common to all of them, else any control's own words; a single control never
 * inherits a fieldset's.
 */
function merged(same: readonly { param: ToolParam; group: string | null }[]): ToolParam {
  const controls = same.map((entry) => entry.param)
  const groups = new Set(same.map((entry) => entry.group))
  const shared = same.length > 1 && groups.size === 1 ? [...groups][0] : null
  const own = controls.find((control) => control.description !== null)?.description ?? null
  const first = controls[0] as ToolParam
  return {
    ...first,
    required: controls.some((control) => control.required),
    options: [...new Set(controls.flatMap((control) => control.options))],
    description: shared ?? own,
  }
}

function paramOf(field: Element, labels: ReadonlyMap<string, string>): ToolParam | null {
  const type = typeOf(field)
  const name = text(field.getAttribute('name'))
  if (NOT_PARAMS.has(type) || name === null) return null
  const id = field.getAttribute('id')?.trim()
  const wrapping = field.closest('label')
  const label =
    (id === undefined ? undefined : labels.get(id)) ??
    (wrapping !== null && !wrapping.hasAttribute('for') ? labelText(wrapping) : null)
  return {
    name,
    type,
    required: field.hasAttribute('required'),
    options: optionsOf(field, type),
    description:
      text(field.getAttribute('toolparamdescription')) ??
      text(label) ??
      text(field.getAttribute('aria-description')),
  }
}

/** select, textarea, or an input's type (text when it names none). */
function typeOf(field: Element): string {
  if (field.localName !== 'input') return field.localName
  return (field.getAttribute('type') ?? '').trim().toLowerCase() || 'text'
}

function optionsOf(field: Element, type: string): string[] {
  if (type === 'select') {
    return Array.from(field.querySelectorAll('option')).flatMap((option) => {
      const value = text(option.getAttribute('value')) ?? text(collapse(option.textContent ?? ''))
      return value === null ? [] : [value]
    })
  }
  const value = type === 'radio' ? text(field.getAttribute('value')) : null
  return value === null ? [] : [value]
}

/** The `toolparamdescription` of the nearest fieldset that declares one. */
function groupOf(field: Element, form: Element): string | null {
  for (let at = field.parentElement; at !== null && at !== form; at = at.parentElement) {
    if (at.localName !== 'fieldset') continue
    const described = text(at.getAttribute('toolparamdescription'))
    if (described !== null) return described
  }
  return null
}

/** The page's `<label for>` texts, wherever they sit. */
function labelsById(doc: Document): Map<string, string> {
  const labels = new Map<string, string>()
  for (const label of Array.from(doc.querySelectorAll('label[for]'))) {
    if (isShown(label)) labels.set((label.getAttribute('for') ?? '').trim(), labelText(label))
  }
  return labels
}

/** A field's own text (options, a default value) is no label. */
export function labelText(label: Element): string {
  const parts: string[] = []
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) parts.push(child.textContent ?? '')
      else if (
        child.nodeType === 1 &&
        !['select', 'textarea'].includes((child as Element).localName)
      )
        walk(child)
    }
  }
  walk(label)
  return collapse(parts.join(' '))
}

function text(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim().slice(0, TEXT_CHARS)
  return trimmed === '' ? null : trimmed
}
