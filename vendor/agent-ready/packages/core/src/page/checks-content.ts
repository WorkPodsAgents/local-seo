// What the page shows (FlagRules.content, .links, .hreflang): title and meta, headings, words,
// structured data, images, insecure resources, internal nofollow links and hreflang codes. All
// are judged on the rendered page where there is one, as WorkPods judges its browser capture.
import type { Evidence, Finding } from '../model'
import { absolute, collapse, isShown } from './dom'
import { validHreflang } from './hreflang-codes'
import { are, count, finding, someOf } from './page-checks'
import type { PageRead } from './read'
import { selectorFor } from './selector'

const TITLE_LONG = 60
const TITLE_SHORT = 20
/** InventoryFlag.THIN_WORDS. */
const THIN_WORDS = 250

const CONTENT_CHECKS = [
  'missing_title',
  'title_too_long',
  'title_too_short',
  'missing_meta_description',
  'missing_h1',
  'multiple_h1',
  'thin_content',
  'missing_schema',
  'invalid_schema',
  'missing_alt_text',
  'mixed_content',
  'internal_nofollow',
  'hreflang_invalid_code',
]

export function contentChecks(page: PageRead): Finding[] {
  if (!page.ok) {
    const summary = `The page answered ${page.snapshot.status}, so this was not checked.`
    return CONTENT_CHECKS.map((id) => finding(id, 'not_applicable', summary))
  }
  return [
    ...title(page),
    description(page),
    ...h1(page),
    thin(page),
    ...schema(page),
    altText(page),
    mixedContent(page),
    internalNofollow(page),
    hreflang(page),
  ]
}

function title(page: PageRead): Finding[] {
  const { title, titleElement } = page.shown.head
  if (title === null) {
    const none = 'The page has no title.'
    return [
      finding('missing_title', 'fail', none),
      finding('title_too_long', 'not_applicable', none),
      finding('title_too_short', 'not_applicable', none),
    ]
  }
  const evidence: Evidence[] = [
    titleElement === null
      ? { value: title, note: 'og:title' }
      : { value: title, selector: selectorFor(titleElement) },
  ]
  const length = `The title is ${count(title.length, 'character')}`
  return [
    finding('missing_title', 'pass', 'The page has a title.', evidence),
    title.length > TITLE_LONG
      ? finding('title_too_long', 'fail', `${length}, over ${TITLE_LONG}.`, evidence)
      : finding('title_too_long', 'pass', `${length}.`, evidence),
    title.length < TITLE_SHORT
      ? finding('title_too_short', 'fail', `${length}, under ${TITLE_SHORT}.`, evidence)
      : finding('title_too_short', 'pass', `${length}.`, evidence),
  ]
}

function description(page: PageRead): Finding {
  const text = page.shown.head.description
  return text === null
    ? finding('missing_meta_description', 'fail', 'The page has no meta description.')
    : finding(
        'missing_meta_description',
        'pass',
        `The meta description is ${count(text.length, 'character')}.`,
        [{ value: text }],
      )
}

function h1(page: PageRead): Finding[] {
  const elements = Array.from(page.shown.doc.querySelectorAll('h1')).filter(
    (element) => isShown(element) && collapse(element.textContent ?? '') !== '',
  )
  const evidence = elements.map((element) => ({
    selector: selectorFor(element),
    value: collapse(element.textContent ?? ''),
  }))
  const found = `The page has ${count(elements.length, 'H1 heading')}.`
  return [
    finding('missing_h1', elements.length === 0 ? 'fail' : 'pass', found, evidence),
    finding('multiple_h1', elements.length > 1 ? 'fail' : 'pass', found, evidence),
  ]
}

function thin(page: PageRead): Finding {
  const words = page.shown.words
  return words < THIN_WORDS
    ? finding('thin_content', 'fail', `The page has ${count(words, 'word')}, under ${THIN_WORDS}.`)
    : finding('thin_content', 'pass', `The page has ${count(words, 'word')}.`)
}

function schema(page: PageRead): Finding[] {
  const { types, blocks, invalid } = page.shown.schema
  const typeEvidence = types.map((type) => ({ value: type }))
  return [
    types.length === 0
      ? finding('missing_schema', 'fail', 'The page declares no structured data.')
      : finding(
          'missing_schema',
          'pass',
          `The page declares ${count(types.length, 'schema type')}.`,
          typeEvidence,
        ),
    invalid > 0
      ? finding(
          'invalid_schema',
          'fail',
          `${someOf(invalid, blocks, 'JSON-LD block')} not valid JSON.`,
        )
      : finding('invalid_schema', 'pass', `Every JSON-LD block is valid JSON (${blocks}).`),
  ]
}

/** `alt=""` marks a decorative image, which is no defect; only a missing attribute is. */
function altText(page: PageRead): Finding {
  const source = (image: Element) =>
    (image.getAttribute('src') ?? image.getAttribute('data-src') ?? '').trim()
  const images = Array.from(page.shown.doc.querySelectorAll('img')).filter(
    (image) => isShown(image) && source(image) !== '',
  )
  const missing = images.filter((image) => !image.hasAttribute('alt'))
  const evidence = missing.map((image) => ({
    selector: selectorFor(image),
    url: absolute(source(image), page.shown.base) ?? source(image),
  }))
  if (images.length === 0) return finding('missing_alt_text', 'pass', 'The page has no images.')
  if (missing.length === 0) {
    const summary = `Every image has alt text (${images.length}).`
    return finding('missing_alt_text', 'pass', summary)
  }
  const summary = `${someOf(missing.length, images.length, 'image')} missing alt text.`
  const status = missing.length === images.length ? 'fail' : 'partial'
  return finding('missing_alt_text', status, summary, evidence)
}

/** Resources a page loads, by tag; links to other pages are no resources. */
const LOADED_RELS = new Set(['stylesheet', 'icon', 'preload', 'modulepreload'])
const RESOURCES = 'img, script, iframe, audio, video, source, embed, track, object, link'

function mixedContent(page: PageRead): Finding {
  const { doc, base } = page.shown
  if (!page.snapshot.url.startsWith('https:')) {
    return finding('mixed_content', 'not_applicable', 'The page is not served over https.')
  }
  const insecure = Array.from(doc.querySelectorAll(RESOURCES)).flatMap((element) => {
    if (element.closest('noscript, template') !== null) return []
    const source = resourceOf(element)
    const url = source === null ? null : absolute(source, base)
    return url?.startsWith('http:') ? [{ selector: selectorFor(element), url }] : []
  })
  const unique = new Set(insecure.map((entry) => entry.url))
  return unique.size === 0
    ? finding('mixed_content', 'pass', 'The page loads every resource over https.')
    : finding(
        'mixed_content',
        'fail',
        `The page loads ${count(unique.size, 'resource')} over plain http.`,
        insecure,
      )
}

function resourceOf(element: Element): string | null {
  if (element.localName === 'object') return element.getAttribute('data')
  if (element.localName !== 'link') return element.getAttribute('src')
  const rels = (element.getAttribute('rel') ?? '').toLowerCase().split(/\s+/)
  return rels.some((rel) => LOADED_RELS.has(rel)) ? element.getAttribute('href') : null
}

function internalNofollow(page: PageRead): Finding {
  const { links, anchors } = page.shown
  const evidence = links.flatMap((link, at) => {
    const anchor = anchors[at]
    return link.internal && link.rel.includes('nofollow') && anchor !== undefined
      ? [{ selector: selectorFor(anchor), url: link.url }]
      : []
  })
  return evidence.length === 0
    ? finding('internal_nofollow', 'pass', 'No internal link is marked nofollow.')
    : finding(
        'internal_nofollow',
        'fail',
        `${count(evidence.length, 'internal link')} ${are(evidence.length)} marked nofollow.`,
        evidence,
      )
}

function hreflang(page: PageRead): Finding {
  const alternates = page.hreflang
  if (alternates.length === 0) {
    return finding('hreflang_invalid_code', 'not_applicable', 'The page declares no hreflang.')
  }
  const invalid = alternates.filter((alternate) => !validHreflang(alternate.lang))
  const evidence = invalid.map((alternate) => ({ value: alternate.lang, url: alternate.url }))
  return invalid.length === 0
    ? finding(
        'hreflang_invalid_code',
        'pass',
        `Every hreflang code is valid (${alternates.length}).`,
      )
    : finding(
        'hreflang_invalid_code',
        'fail',
        `${someOf(invalid.length, alternates.length, 'hreflang code')} invalid.`,
        evidence,
      )
}
