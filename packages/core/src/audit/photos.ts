import { isMissing } from '../business'
import { localThreshold } from '../registry'
import type { CheckFn } from './finding'
import { finding, graded, unknown } from './finding'

const count: CheckFn = (b) => {
  if (isMissing(b.photoCount)) return unknown('L17', 'The photo count', b.photoCount.reason)
  const status = graded(b.photoCount, localThreshold('L17', 'min'), localThreshold('L17', 'good'))
  return finding('L17', status, `The profile has ${b.photoCount} photos.`)
}

/** A share from a handful of reviews says little. */
const MIN_REVIEWS = 10

const reviewPhotos: CheckFn = (_b, extras) => {
  const reviews = extras.reviews ?? []
  if (reviews.length < MIN_REVIEWS) {
    return finding('L18', 'not_applicable', `Fewer than ${MIN_REVIEWS} reviews were read.`)
  }
  const withPhotos = reviews.filter((review) => review.photoCount > 0).length
  const share = withPhotos / reviews.length
  const status = graded(share, Number.MIN_VALUE, localThreshold('L18', 'share'))
  const summary = `${withPhotos} of ${reviews.length} reviews read carry photos.`
  return finding('L18', status, summary)
}

export const PHOTOS: readonly CheckFn[] = [count, reviewPhotos]
