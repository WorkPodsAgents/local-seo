// Grid geometry for rank-from-anywhere: points a fixed ground distance apart, so a 7x7 grid at
// 1 km covers the same area at the equator and in Oslo.
import type { LatLng } from '../business'

const EARTH_RADIUS_KM = 6371.0088

export interface GridPoint extends LatLng {
  /** 0-based from the north-west corner; the centre is (size-1)/2, (size-1)/2. */
  readonly row: number
  readonly col: number
}

const MIN_SIZE = 3
const MAX_SIZE = 13

/** A size x size grid centred on `center`, `spacingKm` between neighbours, north row first. */
export function gridPoints(center: LatLng, size: number, spacingKm: number): GridPoint[] {
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE || size % 2 === 0) {
    throw new Error(`grid size must be odd, ${MIN_SIZE} to ${MAX_SIZE}: ${size}`)
  }
  if (!(spacingKm > 0)) throw new Error(`grid spacing must be positive: ${spacingKm}`)
  const half = (size - 1) / 2
  const points: GridPoint[] = []
  for (let row = 0; row < size; row += 1) {
    const north = (half - row) * spacingKm
    const rowStart = destination(center, north >= 0 ? 0 : 180, Math.abs(north))
    for (let col = 0; col < size; col += 1) {
      const east = (col - half) * spacingKm
      const point = destination(rowStart, east >= 0 ? 90 : 270, Math.abs(east))
      points.push({ row, col, lat: round7(point.lat), lng: round7(point.lng) })
    }
  }
  return points
}

/** Great-circle distance in km (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = radians(b.lat - a.lat)
  const dLng = radians(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** The point `km` away from `from` along the initial bearing `bearingDeg` (0 north, 90 east). */
export function destination(from: LatLng, bearingDeg: number, km: number): LatLng {
  const angular = km / EARTH_RADIUS_KM
  const bearing = radians(bearingDeg)
  const lat1 = radians(from.lat)
  const lng1 = radians(from.lng)
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    )
  return { lat: degrees(lat2), lng: ((degrees(lng2) + 540) % 360) - 180 }
}

function radians(deg: number): number {
  return (deg * Math.PI) / 180
}

function degrees(rad: number): number {
  return (rad * 180) / Math.PI
}

/** Seven decimals is about 1 cm, what Maps URLs carry. */
function round7(value: number): number {
  return Math.round(value * 1e7) / 1e7
}
