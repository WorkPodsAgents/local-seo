// A complete, healthy profile that each test bends one way, so a test names only what it changes.
import type { Business, Post, Review } from '../src/business'

export const NOW = new Date('2026-11-02T12:00:00Z')

export function aBusiness(changes: Partial<Business> = {}): Business {
  return {
    source: 'maps_page',
    readAt: NOW.toISOString(),
    ids: { placeId: 'ChIJtarget', cid: '111', kgId: null, featureId: null },
    name: 'Nyack Plumbing Co',
    categories: {
      primary: 'Plumber',
      secondary: ['Water heater installation service', 'Drainage service'],
    },
    address: {
      formatted: '250 W Nyack Rd #200, West Nyack, NY 10994',
      street: '250 W Nyack Rd #200',
      city: 'West Nyack',
      region: 'New York',
      postalCode: '10994',
      country: 'US',
    },
    serviceAreas: [],
    location: { lat: 41.0973, lng: -73.9934 },
    phone: '+1 845-555-0100',
    website: 'https://www.nyackplumbing.com/',
    hours: {
      intervals: (['mon', 'tue', 'wed', 'thu', 'fri'] as const).map((day) => ({
        day,
        opens: '08:00',
        closes: '17:00',
      })),
      open24h: [],
    },
    attributes: [
      { group: 'Accessibility', values: ['Wheelchair-accessible entrance', 'Parking', 'Restroom'] },
    ],
    services: ['Drain cleaning', 'Water heater repair', 'Leak detection'],
    products: ['Boiler service plan'],
    description:
      'Nyack Plumbing Co is a licensed plumber serving West Nyack and the rest of Rockland ' +
      'County since 1998. We repair leaks, clear blocked drains, install and service water ' +
      'heaters and boilers, and answer emergency calls around the clock. Every job comes with ' +
      'an upfront price and a written guarantee from our own team of plumbers.',
    rating: 4.6,
    reviewCount: 120,
    photoCount: 40,
    claimed: true,
    closure: null,
    ...changes,
  }
}

export function aReview(changes: Partial<Review> = {}): Review {
  return {
    id: 'r1',
    rating: 5,
    text: 'Fast and friendly plumber.',
    publishedAt: '2026-10-20T10:00:00Z',
    relativeAge: null,
    ownerReply: { text: 'Thank you!', publishedAt: '2026-10-21T10:00:00Z' },
    authorReviewCount: 3,
    photoCount: 0,
    ...changes,
  }
}

export function aPost(changes: Partial<Post> = {}): Post {
  return {
    text: 'Winter boiler checks are open for booking.',
    publishedAt: '2026-10-28T09:00:00Z',
    relativeAge: null,
    hasMedia: true,
    link: 'https://www.nyackplumbing.com/book',
    kind: 'offer',
    ...changes,
  }
}
