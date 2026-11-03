// DataForSEO's reviews, posts and Maps results mapped into the shared shapes.
import type { LatLng, Post, RankedBusiness, Review } from '../../business'
import {
  array,
  number,
  object,
  text,
} from '../../../../../vendor/agent-ready/packages/core/src/providers/json'
import type { JsonObject } from '../../../../../vendor/agent-ready/packages/core/src/providers/json'

/** "2024-05-05 14:09:32 +00:00", DataForSEO's timestamp format, as ISO; null when unreadable. */
export function isoTimestamp(value: unknown): string | null {
  const raw = text(value)
  const match =
    raw === null
      ? null
      : /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2}:\d{2})$/.exec(raw.trim())
  if (match === null) return null
  const date = new Date(`${match[1]}T${match[2]}${match[3]}`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** A `google_reviews_search` item; null without a star rating, which every review has. */
export function reviewOf(item: JsonObject): Review | null {
  const answer = text(item['owner_answer'])
  const rating = number(object(item['rating'])?.['value'])
  if (rating === null) return null
  return {
    id: text(item['review_id']),
    rating,
    text: text(item['review_text']),
    publishedAt: isoTimestamp(item['timestamp']),
    relativeAge: text(item['time_ago']),
    ownerReply:
      answer === null ? null : { text: answer, publishedAt: isoTimestamp(item['owner_timestamp']) },
    authorReviewCount: number(item['reviews_count']),
    photoCount: array(item['images']).length,
  }
}

/** A `google_business_post` item; DataForSEO does not say whether it is an offer or event. */
export function postOf(item: JsonObject): Post {
  return {
    text: text(item['post_text']) ?? '',
    publishedAt: isoTimestamp(item['timestamp']),
    relativeAge: null,
    hasMedia: text(item['images_url']) !== null,
    link: text(object(array(item['links'])[0])?.['url']),
    kind: 'unknown',
  }
}

/** A `maps_search` or `maps_paid_item`; paid items keep their own rank, flagged sponsored. */
export function rankedOf(item: JsonObject): RankedBusiness | null {
  const position = number(item['rank_group'])
  const name = text(item['title'])
  if (position === null || name === null) return null
  return {
    position,
    sponsored: item['type'] === 'maps_paid_item',
    name,
    ids: {
      placeId: text(item['place_id']),
      cid: text(item['cid']),
      kgId: null,
      featureId: text(item['feature_id']),
    },
    primaryCategory: text(item['category']),
    rating: number(object(item['rating'])?.['value']),
    reviewCount: number(object(item['rating'])?.['votes_count']),
    address: text(item['address']),
    location: pointOf(item),
  }
}

function pointOf(item: JsonObject): LatLng | null {
  const lat = number(item['latitude'])
  const lng = number(item['longitude'])
  return lat === null || lng === null ? null : { lat, lng }
}
