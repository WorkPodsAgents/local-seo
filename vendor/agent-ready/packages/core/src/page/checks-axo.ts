// What a browser builds for agents (AgentChecks.kt): its JSON-LD entities' properties, its
// declarative WebMCP tools, the accessible names of its controls, and (AX2) the forms no tool
// exposes. Schema properties and tools are never judged on the raw answer, as WorkPods never
// judges them without a render.
import type { Finding } from '../model'
import { unlabelledControls } from './accname'
import { isShown } from './dom'
import { count, finding, someOf } from './page-checks'
import type { PageRead } from './read'
import { selectorFor } from './selector'
import { declaredTools } from './webmcp'

const SNIPPET_CHARS = 160

export function axoChecks(page: PageRead): Finding[] {
  const ids = ['schema_properties_missing', 'webmcp_tool_incomplete', 'controls_unlabelled', 'AX2']
  if (!page.ok) {
    const summary = `The page answered ${page.snapshot.status}, so this was not checked.`
    return ids.map((id) => finding(id, 'not_applicable', summary))
  }
  const rendered = page.rendered?.doc ?? null
  const noRender = 'Needs the rendered page, which was not available.'
  return [
    rendered === null
      ? finding('schema_properties_missing', 'not_applicable', noRender)
      : schemaProperties(page.rendered?.schema.missing ?? null),
    rendered === null
      ? finding('webmcp_tool_incomplete', 'not_applicable', noRender)
      : webMcpTools(rendered),
    controls(page.shown.doc),
    formsExposed(page.shown.doc),
  ]
}

function schemaProperties(missing: readonly string[] | null): Finding {
  const id = 'schema_properties_missing'
  if (missing === null) {
    return finding(id, 'not_applicable', 'The page has no schema entity of a type this checks.')
  }
  return missing.length === 0
    ? finding(id, 'pass', 'Every schema entity has its recommended properties.')
    : finding(
        id,
        'fail',
        `The schema lacks ${count(missing.length, 'recommended property', 'properties')}.`,
        missing.map((property) => ({ value: property })),
      )
}

function webMcpTools(doc: Document): Finding {
  const id = 'webmcp_tool_incomplete'
  const tools = declaredTools(doc)
  if (tools.length === 0) return finding(id, 'not_applicable', 'The page declares no WebMCP tools.')
  const incomplete = tools.filter((tool) => !tool.complete)
  const evidence = incomplete.map((tool) => {
    const fields = tool.params
      .filter((param) => param.description === null)
      .map((param) => param.name)
    const lacks = [
      ...(tool.description === null ? ['a tooldescription'] : []),
      ...(fields.length === 0 ? [] : [`a description for ${fields.join(', ')}`]),
    ]
    return { selector: tool.selector, value: tool.name, note: `Lacks ${lacks.join(' and ')}.` }
  })
  return incomplete.length === 0
    ? finding(id, 'pass', `Every WebMCP tool is fully described (${tools.length}).`)
    : finding(
        id,
        'fail',
        `${someOf(incomplete.length, tools.length, 'WebMCP tool')} not fully described.`,
        evidence,
      )
}

function controls(doc: Document): Finding {
  const id = 'controls_unlabelled'
  const unlabelled = unlabelledControls(doc)
  const evidence = unlabelled.map((control) => ({
    selector: selectorFor(control),
    value: control.outerHTML.slice(0, SNIPPET_CHARS),
  }))
  if (unlabelled.length === 0) {
    return finding(id, 'pass', 'Every button, link and field has an accessible name.')
  }
  const have = unlabelled.length === 1 ? 'has' : 'have'
  const which = count(unlabelled.length, 'button, link or field', 'buttons, links or fields')
  const summary = `${which} ${have} no accessible name.`
  return finding(id, 'fail', summary, evidence)
}

/** Buttons and hidden inputs are not fields an agent fills. */
const NOT_FIELDS = new Set(['hidden', 'submit', 'button', 'reset', 'image'])

interface PageForm {
  readonly form: Element
  readonly fields: readonly string[]
  readonly search: boolean
}

/**
 * AX2: the forms an agent would use that no WebMCP tool exposes. The axo reference counts the
 * forms key tasks rely on (quote, booking, search, contact), so a search form or one with two or
 * more fields is key (medium) and a lone field, such as a newsletter box, is secondary (low).
 * Sign-in forms are left out: agents must never sign in. A page with no such form has nothing to
 * expose, which is not applicable.
 */
function formsExposed(doc: Document): Finding {
  const id = 'AX2'
  const forms = Array.from(doc.querySelectorAll('form'))
    .filter(isShown)
    .map(formOf)
    .filter(
      (form) =>
        form.fields.length > 0 && form.form.querySelector('input[type="password"]') === null,
    )
  if (forms.length === 0) {
    return finding(id, 'not_applicable', 'The page has no form an agent would fill in.')
  }
  const bare = forms.filter((form) => (form.form.getAttribute('toolname') ?? '').trim() === '')
  if (bare.length === 0) {
    return finding(id, 'pass', `Every form is exposed as a WebMCP tool (${forms.length}).`)
  }
  const key = bare.some((form) => form.search || form.fields.length >= 2)
  const evidence = bare.map((form) => ({
    selector: selectorFor(form.form),
    value: form.fields.join(', '),
    note: form.search ? 'A search form.' : `A form with ${count(form.fields.length, 'field')}.`,
  }))
  const one = bare.length === 1
  const summary =
    `${bare.length} of ${count(forms.length, 'form')} ${one ? 'has' : 'have'} no WebMCP tool, ` +
    `so agents must fill ${one ? 'it' : 'them'} in field by field.`
  return finding(id, 'fail', summary, evidence, key ? 'medium' : 'low')
}

function formOf(form: Element): PageForm {
  const fields = Array.from(form.querySelectorAll('input, select, textarea')).filter(
    (field) => isShown(field) && !(field.localName === 'input' && NOT_FIELDS.has(inputType(field))),
  )
  const names = fields.map(
    (field) => field.getAttribute('name') ?? field.getAttribute('id') ?? field.localName,
  )
  const search =
    form.getAttribute('role') === 'search' ||
    form.closest('[role="search"], search') !== null ||
    fields.some((field) => inputType(field) === 'search')
  return { form, fields: [...new Set(names)], search }
}

function inputType(field: Element): string {
  return (field.getAttribute('type') ?? 'text').trim().toLowerCase()
}
