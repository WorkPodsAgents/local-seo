// Opening hours from schema.org (openingHoursSpecification objects or openingHours strings such
// as "Mo-Fr 09:00-17:00") in the same "mon 09:00-17:00" form as a profile's hours.
import type { Hours, Weekday } from '../business'

const WEEK: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const SHORT: Readonly<Record<string, Weekday>> = {
  mo: 'mon',
  tu: 'tue',
  we: 'wed',
  th: 'thu',
  fr: 'fri',
  sa: 'sat',
  su: 'sun',
}

/** A profile's hours as sorted "day HH:MM-HH:MM" slots; a 24-hour day is "day 00:00-24:00". */
export function profileSlots(hours: Hours): string[] {
  return sortSlots([
    ...hours.intervals.map((slot) => `${slot.day} ${slot.opens}-${slot.closes}`),
    ...hours.open24h.map((day) => `${day} 00:00-24:00`),
  ])
}

/** Hours declared by schema entities; empty when none declares any. */
export function schemaSlots(entities: readonly Record<string, unknown>[]): string[] {
  const slots: string[] = []
  for (const entity of entities) {
    for (const spec of list(entity['openingHoursSpecification'])) {
      if (typeof spec !== 'object' || spec === null) continue
      const record = spec as Record<string, unknown>
      const opens = time(record['opens'])
      const closes = time(record['closes'])
      if (opens === null || closes === null) continue
      for (const day of list(record['dayOfWeek']).flatMap(dayOf)) {
        slots.push(slot(day, opens, closes))
      }
    }
    for (const line of list(entity['openingHours'])) {
      if (typeof line === 'string') slots.push(...parseLine(line))
    }
  }
  return sortSlots([...new Set(slots)])
}

function list(value: unknown): unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function dayOf(value: unknown): Weekday[] {
  if (typeof value !== 'string') return []
  const name = value
    .replace(/^https?:\/\/schema\.org\//i, '')
    .toLowerCase()
    .slice(0, 3)
  return WEEK.includes(name as Weekday) ? [name as Weekday] : []
}

function time(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  return match === null ? null : `${match[1]?.padStart(2, '0')}:${match[2]}`
}

/** Schema writers use 23:59 for "until midnight"; the profile says 24:00. */
function slot(day: Weekday, opens: string, closes: string): string {
  const end = closes === '23:59' || (opens === '00:00' && closes === '00:00') ? '24:00' : closes
  return `${day} ${opens}-${end}`
}

/** "Mo-Fr 09:00-17:00", "Sa,Su 10:00-14:00" or "Mo-Su" (all day). */
function parseLine(line: string): string[] {
  const match = /^\s*([A-Za-z,\s-]+?)\s*(?:(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2}))?\s*$/.exec(line)
  if (match === null) return []
  const days = (match[1] ?? '').split(',').flatMap((part) => dayRange(part.trim()))
  const opens = time(match[2] ?? '00:00') ?? '00:00'
  const closes = time(match[3] ?? '24:00') ?? '24:00'
  return days.map((day) => slot(day, opens, closes))
}

function dayRange(part: string): Weekday[] {
  const [from, to] = part
    .toLowerCase()
    .split('-')
    .map((day) => SHORT[day.trim().slice(0, 2)])
  if (from === undefined) return []
  if (to === undefined) return [from]
  const start = WEEK.indexOf(from)
  const end = WEEK.indexOf(to)
  return end >= start
    ? WEEK.slice(start, end + 1)
    : [...WEEK.slice(start), ...WEEK.slice(0, end + 1)]
}

function sortSlots(slots: string[]): string[] {
  const order = (entry: string) => WEEK.indexOf(entry.slice(0, 3) as Weekday)
  return slots.sort((a, b) => order(a) - order(b) || a.localeCompare(b))
}
