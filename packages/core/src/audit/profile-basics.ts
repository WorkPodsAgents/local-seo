import type { Business } from '../business'
import { isMissing } from '../business'
import type { CheckFn } from './finding'
import { finding, presence, unknown } from './finding'

const phone: CheckFn = (b) => presence('L1', b.phone, 'Phone number', (value) => value)
const website: CheckFn = (b) => presence('L2', b.website, 'Website', (value) => value)

const hours: CheckFn = (b) => {
  if (isMissing(b.hours)) {
    if (b.hours.absent === true) return finding('L3', 'fail', 'The profile lists no hours.')
    return unknown('L3', 'Opening hours', b.hours.reason)
  }
  const days = new Set([...b.hours.intervals.map((slot) => slot.day), ...b.hours.open24h])
  if (days.size === 0) return finding('L3', 'partial', 'Hours are listed as closed every day.')
  return finding('L3', 'pass', `Hours are listed for ${days.size} days a week.`)
}

const claimed: CheckFn = (b) => {
  if (isMissing(b.claimed)) return unknown('L4', 'Claim status', b.claimed.reason)
  return b.claimed
    ? finding('L4', 'pass', 'The profile is claimed.')
    : finding('L4', 'fail', 'The profile is not claimed: Maps offers "Own this business?".')
}

const notClosed: CheckFn = (b) =>
  b.closure === 'permanent'
    ? finding('L5', 'fail', 'Google marks the business permanently closed.')
    : finding('L5', 'pass', 'The business is not marked permanently closed.')

const located: CheckFn = (b: Business) => {
  if (!isMissing(b.address)) {
    return finding('L6', 'pass', 'The address is shown.', [{ value: b.address.formatted }])
  }
  if (!isMissing(b.serviceAreas) && b.serviceAreas.length > 0) {
    const areas = b.serviceAreas.join(', ')
    return finding('L6', 'pass', 'Service areas are listed.', [{ value: areas }])
  }
  if (b.address.absent === true && !isMissing(b.serviceAreas)) {
    return finding('L6', 'fail', 'The profile shows neither an address nor service areas.')
  }
  return unknown('L6', 'Address', b.address.reason)
}

export const PROFILE_BASICS: readonly CheckFn[] = [
  phone,
  website,
  hours,
  claimed,
  notClosed,
  located,
]
