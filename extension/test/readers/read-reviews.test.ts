// Saved signed-out Maps pages, captured 2026-11-02; see test/fixtures. The limited view shows
// five reviews on the Reviews tab and three on the Overview.
import { describe, expect, it } from 'vitest'
import {
  expandReviews,
  openReviewsTab,
  readReviews,
  reviewsFeed,
  sortReviewsNewest,
} from '../../src/readers/maps/read-reviews'
import { savedMapsPage } from './maps-fixture'

const noWait = async () => undefined

describe("opening a place's Reviews tab", () => {
  it('given the Overview, when the Reviews tab is clicked and selected, it is open', async () => {
    const { document } = savedMapsPage('place-dentist-austin')
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
    let clicks = 0
    // Maps selects the tab it was clicked on; the saved page has no script to do it.
    const reviewsTab = document.querySelector('[role="tab"][aria-label^="Reviews"]')
    reviewsTab?.addEventListener('click', () => {
      clicks += 1
      for (const tab of tabs) tab.setAttribute('aria-selected', String(tab === reviewsTab))
    })
    expect(await openReviewsTab(document, noWait)).toBe(true)
    expect(clicks).toBe(1)
  })

  it('given the Overview, when a click changes nothing, its reviews do not count', async () => {
    const { document } = savedMapsPage('place-dentist-austin')
    expect(await openReviewsTab(document, noWait)).toBe(false)
  })

  it('given the Reviews tab already open, then it is not clicked again', async () => {
    const { document } = savedMapsPage('reviews-dentist-austin')
    const reviewsTab = document.querySelector('[role="tab"][aria-label^="Reviews"]')
    let clicks = 0
    reviewsTab?.addEventListener('click', () => (clicks += 1))
    expect(await openReviewsTab(document, noWait)).toBe(true)
    expect(clicks).toBe(0)
  })

  it('given a results list with no place open, then there is no Reviews tab', async () => {
    const { document } = savedMapsPage('results-dentist-austin')
    expect(await openReviewsTab(document, noWait)).toBe(false)
  })
})

describe('sorting the Reviews tab by Newest', () => {
  /** Maps' menu as its sort button opens it; no saved page holds it, so it is built here. */
  function withSortMenu(labels: readonly string[], resorts: boolean) {
    const { document } = savedMapsPage('reviews-dentist-austin')
    const chosen: string[] = []
    document.querySelector('button[data-value="Sort"]')?.addEventListener('click', () => {
      const menu = document.createElement('div')
      menu.setAttribute('role', 'menu')
      for (const label of labels) {
        const item = document.createElement('div')
        item.setAttribute('role', 'menuitemradio')
        item.setAttribute('aria-checked', String(label === labels[0]))
        item.textContent = label
        item.addEventListener('click', () => {
          chosen.push(label)
          // Maps re-renders the list in the new order; the old review elements leave the page.
          if (resorts) document.querySelector('[data-review-id]')?.remove()
        })
        menu.append(item)
      }
      document.body.append(menu)
    })
    return { document, chosen }
  }

  it('given the menu, then Newest is chosen and the re-rendered list is sorted', async () => {
    const labels = ['Most relevant', 'Newest', 'Highest rating', 'Lowest rating']
    const { document, chosen } = withSortMenu(labels, true)
    expect(await sortReviewsNewest(document, noWait)).toBe(true)
    expect(chosen).toEqual(['Newest'])
  })

  it('given labels in another language, then the second item is chosen', async () => {
    const labels = ['Más relevantes', 'Más recientes', 'Mejor valoradas', 'Peor valoradas']
    const { document, chosen } = withSortMenu(labels, true)
    expect(await sortReviewsNewest(document, noWait)).toBe(true)
    expect(chosen).toEqual(['Más recientes'])
  })

  it('given the list never re-renders, then the sort is not claimed', async () => {
    const labels = ['Most relevant', 'Newest', 'Highest rating', 'Lowest rating']
    const { document } = withSortMenu(labels, false)
    expect(await sortReviewsNewest(document, noWait)).toBe(false)
  })

  it('given signed out, the sign-in wall Maps shows instead is closed and no sort claimed', async () => {
    // As seen live on 2026-11-02: Sort opens this dialog, not the menu, without a Google sign-in.
    const { document } = savedMapsPage('reviews-dentist-austin')
    let dismissed = false
    document.querySelector('button[data-value="Sort"]')?.addEventListener('click', () => {
      const dialog = document.createElement('div')
      dialog.setAttribute('role', 'dialog')
      dialog.innerHTML =
        '<button jsaction="pane.wfvdle116.dismiss">Dismiss</button>' +
        '<button jsaction="pane.wfvdle116.signIn">Sign in</button>'
      dialog.querySelector('button')?.addEventListener('click', () => (dismissed = true))
      document.body.append(dialog)
    })
    expect(await sortReviewsNewest(document, noWait)).toBe(false)
    expect(dismissed).toBe(true)
  })

  it('given no menu opens, then the sort is not claimed', async () => {
    const { document } = savedMapsPage('reviews-dentist-austin')
    expect(await sortReviewsNewest(document, noWait)).toBe(false)
  })
})

function reviewsIn(name: string) {
  const feed = reviewsFeed(savedMapsPage(name).document)
  if (feed === null) throw new Error(`${name} shows no reviews`)
  return { feed, reviews: readReviews(feed.container) }
}

describe('reading the reviews a place panel has loaded', () => {
  it('reads each review once with its rating, age, author count and owner reply', () => {
    const { feed, reviews } = reviewsIn('reviews-dentist-austin')
    expect(feed.count()).toBe(5)
    expect(reviews).toHaveLength(5)
    expect(reviews[0]).toMatchObject({
      id: 'Ci9DQUlRQUNvZENodHljRjlvT25KamNGWXRPRTg1UTJzd2NsQnlkV2RUUnpCaFFrRRAB',
      rating: 5,
      publishedAt: null,
      relativeAge: '3 months ago',
      ownerReply: {
        text: 'Your feedback helps us continue to improve – thank you!',
        publishedAt: null,
      },
      authorReviewCount: 24,
      photoCount: 0,
    })
    expect(reviews[0]?.text).toMatch(/^I absolutely love this dentist/)
    expect(reviews[0]?.text).not.toMatch(/More$/)
    expect(reviews.map((review) => review.authorReviewCount)).toEqual([24, 3, 19, 5, 4])
  })

  it('counts the photos on a review and reads a low rating with no reply', () => {
    const { reviews } = reviewsIn('place-plumber-austin')
    expect(reviews[0]).toMatchObject({ rating: 5, relativeAge: '6 years ago', photoCount: 4 })
    expect(reviews[1]).toMatchObject({ rating: 2, ownerReply: null, authorReviewCount: 7 })
  })

  it('opens the reviews cut short with More before they are read', () => {
    const { feed } = reviewsIn('reviews-dentist-austin')
    const opened: string[] = []
    feed.container.addEventListener('click', (event) => {
      opened.push((event.target as Element).getAttribute('data-review-id') ?? '')
    })
    expect(expandReviews(feed.container)).toBe(2)
    expect(opened).toHaveLength(2)
  })

  it('finds no review list on a results page', () => {
    expect(reviewsFeed(savedMapsPage('results-dentist-austin').document)).toBeNull()
  })
})
