// The language a Google Maps page is drawn in. Some readers match Maps' English wording (the
// limited-view banner, "959 Photos", day names, the claim prompt, the Newest sort), so on a page
// in another language those fields go missing; the panel and the tools then say why.

/**
 * The page's language: the `hl` parameter, which Maps obeys over the account's setting, else the
 * document's `lang`; null when neither says.
 */
export function mapsLanguage(doc: Document, url: string): string | null {
  const hl = new URL(url).searchParams.get('hl')
  if (hl !== null && hl.trim() !== '') return hl.trim()
  const lang = doc.documentElement.getAttribute('lang')
  return lang === null || lang.trim() === '' ? null : lang.trim()
}

/** True for any English: `en`, `en-GB`, `en_US`. */
export function readsAsEnglish(language: string): boolean {
  return /^en(-|_|$)/i.test(language)
}

/** The same Maps address with `hl=en`, which shows the page in English. */
export function inEnglish(url: string): string {
  const english = new URL(url)
  english.searchParams.set('hl', 'en')
  return english.toString()
}

/** "German" for `de`; the code itself when the browser has no name for it. */
export function languageName(language: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(language) ?? language
  } catch {
    return language
  }
}

/**
 * The note a tool result or an audit carries when Maps was not in English; null when it was, or
 * when the page named no language and is read as it is.
 */
export function languageNote(language: string | null): string | null {
  if (language === null || readsAsEnglish(language)) return null
  return (
    `Google Maps showed this page in ${languageName(language)} (${language}), and Local SEO ` +
    'reads Maps in English for now, so some fields may be missing. Switch Google to English, ' +
    'or add hl=en to the Maps address, for complete results.'
  )
}
