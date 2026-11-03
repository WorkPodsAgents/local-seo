// Saved signed-out Maps pages, captured 2026-11-02; see test/fixtures. Signed out, Maps shows
// only the newest post, on the Overview.
import { describe, expect, it } from 'vitest'
import { postsFeed, readPlacePostsList, readPosts } from '../../src/readers/maps/read-posts'
import { savedMapsPage } from './maps-fixture'

describe("reading the owner's posts", () => {
  it('reads the newest post with its age, image and call to action', () => {
    const feed = postsFeed(savedMapsPage('place-dentist-manchester-uk').document)
    expect(feed?.count()).toBe(1)
    const posts = feed === null ? [] : readPosts(feed.container)
    expect(posts).toHaveLength(1)
    expect(posts[0]).toMatchObject({
      publishedAt: null,
      relativeAge: '6 days ago',
      hasMedia: true,
      link: 'tel:+441618341643',
      kind: 'unknown',
    })
    expect(posts[0]?.text).toMatch(/^Get the smile you’ve been wishing for this Christmas/)
    expect(posts[0]?.text).toMatch(/christmaswhitening26 for full details\.$/)
  })

  it('finds no posts on a place that shows none', () => {
    expect(postsFeed(savedMapsPage('place-dentist-austin').document)).toBeNull()
  })

  const limits = { want: 30, patience: 3, maxSteps: 40, settleMs: 0 }
  const noWait = async () => undefined

  it('given the limited view and no posts, then the read says the view hid them', async () => {
    const { document } = savedMapsPage('place-dentist-austin')
    expect(await readPlacePostsList(document, limits, noWait)).toEqual({
      items: [],
      stoppedBy: 'limited_view',
    })
  })

  it('given the limited view and its one post, then it is read and the rest hidden', async () => {
    const { document } = savedMapsPage('place-dentist-manchester-uk')
    const read = await readPlacePostsList(document, limits, noWait)
    expect(read.items).toHaveLength(1)
    expect(read.stoppedBy).toBe('limited_view')
  })
})
