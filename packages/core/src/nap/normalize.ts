// Phones and addresses are written many ways; comparing them needs one canonical form each.

/** Digits only, keeping a leading "+": "+1 (877) 467-8789" is "+18774678789". */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return phone.trim().startsWith('+') ? `+${digits}` : digits
}

/**
 * The same number with or without a country code or trunk zero: the shorter one's last digits
 * (at least 7) end the longer one.
 */
export function samePhone(a: string, b: string): boolean {
  const x = a.replace(/\D/g, '').replace(/^0+/, '')
  const y = b.replace(/\D/g, '').replace(/^0+/, '')
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  return short.length >= 7 && long.endsWith(short)
}

const ABBREVIATIONS: Readonly<Record<string, string>> = {
  street: 'st',
  avenue: 'ave',
  road: 'rd',
  suite: 'ste',
  boulevard: 'blvd',
  drive: 'dr',
  lane: 'ln',
  place: 'pl',
  court: 'ct',
  highway: 'hwy',
  parkway: 'pkwy',
  square: 'sq',
  floor: 'fl',
  north: 'n',
  south: 's',
  east: 'e',
  west: 'w',
}

/** Lower case, no punctuation, common street words abbreviated, "#200" read as "ste 200". */
export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/#\s*(\w)/g, 'ste $1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .map((word) => ABBREVIATIONS[word] ?? word)
    .join(' ')
}

/** Letters and digits only, for names: "Rusty-Brick, Inc." is "rustybrickinc". */
export function plainName(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

/** Lower-case words joined and padded by single spaces, so names compare on word boundaries. */
export function wordsOf(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  return words === '' ? '' : ` ${words} `
}

/** Whether `name`'s words appear together in `text`: "Ace" is in "Ace Hardware", not "place". */
export function hasWords(text: string, name: string): boolean {
  const wanted = wordsOf(name)
  return wanted !== '' && wordsOf(text).includes(wanted)
}

/** Words that start the unit part of an address, after normalizeAddress. */
const UNIT = new Set(['ste', 'unit', 'apt', 'fl', 'room', 'rm'])

/**
 * The house number and street of a street line, normalised, without its unit: a site may leave
 * the suite out, and "12 main st" must not be found inside "112 main st".
 */
export function streetKey(street: string): string {
  const words = normalizeAddress(street).split(' ')
  const unitAt = words.findIndex((word) => UNIT.has(word))
  return (unitAt < 0 ? words : words.slice(0, unitAt)).join(' ')
}
