// Reads the opening-hours table on a Maps place panel. Maps writes day names and times in the
// page's language; this reads the English forms ("Monday", "8 AM–4 PM", "8 am–7 pm", "Closed",
// "Open 24 hours") and 24-hour times, and gives up on the whole table rather than guess a day.
import type { Hours, OpenInterval, Weekday } from '@local-seo/core/business'
import { squash, visibleText } from './page'

const DAYS: Readonly<Record<string, Weekday>> = {
  monday: 'mon',
  tuesday: 'tue',
  wednesday: 'wed',
  thursday: 'thu',
  friday: 'fri',
  saturday: 'sat',
  sunday: 'sun',
}

const TIME = /^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i

export type HoursRead =
  | { readonly kind: 'hours'; readonly hours: Hours }
  | { readonly kind: 'none' }
  | { readonly kind: 'unreadable'; readonly text: string }

/**
 * The week's hours from the table under `panel`. `none` when the panel shows no table, and
 * `unreadable` (with the row that failed) when a row is in a form this reader does not know.
 */
export function readHours(panel: Element): HoursRead {
  // Each row is a day cell and an hours cell; the hours cell is the one Maps labels for readers.
  const rows = Array.from(panel.querySelectorAll('tr')).filter(
    (row) => row.querySelector('td[aria-label]') !== null,
  )
  if (rows.length === 0) return { kind: 'none' }
  const intervals: OpenInterval[] = []
  const open24h: Weekday[] = []
  const seen = new Set<Weekday>()
  for (const row of rows) {
    const [dayCell, hoursCell] = Array.from(row.querySelectorAll('td'))
    const dayText = squash(dayCell === undefined ? '' : visibleText(dayCell))
    const day = DAYS[dayText.toLowerCase()]
    if (day === undefined || hoursCell === undefined) return { kind: 'unreadable', text: dayText }
    if (seen.has(day)) continue
    seen.add(day)
    const ranges = Array.from(hoursCell.querySelectorAll('li')).map((li) =>
      squash(li.textContent ?? ''),
    )
    const shown = ranges.length > 0 ? ranges : [squash(hoursCell.textContent ?? '')]
    for (const range of shown) {
      if (/^closed$/i.test(range)) continue
      if (/^open 24 hours$/i.test(range)) {
        open24h.push(day)
        continue
      }
      const interval = intervalOf(day, range)
      if (interval === null) return { kind: 'unreadable', text: `${dayText} ${range}` }
      intervals.push(interval)
    }
  }
  return { kind: 'hours', hours: { intervals, open24h } }
}

/** "8 AM–4 PM", "11:30 AM–2 PM" or "1–5 PM" (the first time takes the second's AM or PM). */
function intervalOf(day: Weekday, range: string): OpenInterval | null {
  const parts = range.split(/\s*[–—-]\s*|\s+to\s+/i)
  if (parts.length !== 2) return null
  const [fromText = '', toText = ''] = parts
  const to = TIME.exec(toText)
  const from = TIME.exec(fromText)
  if (to === null || from === null) return null
  const closes = clock(to, null)
  const opens = clock(from, to[3] ?? null)
  return opens === null || closes === null ? null : { day, opens, closes }
}

function clock(match: RegExpExecArray, fallbackMeridiem: string | null): string | null {
  const hour = Number(match[1])
  const minute = Number(match[2] ?? '0')
  const meridiem = (match[3] ?? fallbackMeridiem)?.toLowerCase().replace(/\./g, '') ?? null
  if (minute > 59) return null
  let hour24 = hour
  if (meridiem === null) {
    if (hour > 24) return null
  } else {
    if (hour < 1 || hour > 12) return null
    hour24 = (hour % 12) + (meridiem === 'pm' ? 12 : 0)
  }
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
