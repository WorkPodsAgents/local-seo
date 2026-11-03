// Reads the owner's posts the place panel shows. The saved pages hold only the newest post, as
// the Overview's "From the owner" card (signed-out Maps has no Updates tab), so this reads that
// card's markup: an element whose action Maps names `.local-post.`. A full Updates tab may use
// other markup; until a signed-in page is saved, this reads none of it rather than guess.
import type { Post } from '@local-seo/core/business'
import {
  scrollAndRead,
  type Feed,
  type ScrollLimits,
  type ScrolledList,
  type Sleep,
} from '../paging'
import { isLimitedView, panelScroller, placePanel, squash, visibleText } from './page'

const POST = '[jsaction*=".local-post."]'
// Matches what core's resolveRelativeAge understands, so an age read here can be dated later.
const AGE = /^(?:edited\s+)?(?:a|an|one|\d+)\s+(?:minute|hour|day|week|month|year)s?\s+ago$/i

export function readPosts(root: ParentNode): readonly Post[] {
  return Array.from(root.querySelectorAll(POST))
    .map(readPost)
    .filter((post) => post !== null)
}

/**
 * The posts the open place shows, scrolled until `limits.want` load. In Maps' limited view a
 * list that ran out, or no posts at all, ends with `limited_view`: signed out, Maps hides the
 * Updates tab, so finding none says nothing about whether the owner posts.
 */
export async function readPlacePostsList(
  doc: Document,
  limits: ScrollLimits,
  sleep: Sleep,
): Promise<ScrolledList<Post>> {
  const read = await scrollAndRead(postsFeed(doc), limits, sleep, readPosts)
  const hidden = read.items.length === 0 || read.stoppedBy === 'end'
  return hidden && isLimitedView(doc) ? { ...read, stoppedBy: 'limited_view' } : read
}

/** The scrollable part of the panel holding the posts; null when the place shows none. */
export function postsFeed(doc: Document): Feed | null {
  const panel = placePanel(doc)
  const first = panel?.querySelector(POST) ?? null
  if (panel === null || first === null) return null
  const container = panelScroller(panel, first)
  if (container === null) return null
  return { container, count: () => container.querySelectorAll(POST).length }
}

/** A post with no text is left out: the model has no way to say its text is unknown. */
function readPost(card: Element): Post | null {
  // The body is the block with the most text; the age and the call to action are short blocks.
  const blocks = Array.from(card.querySelectorAll('div'))
    .filter((block) => block.querySelector('div') === null)
    .map((block) => ({ block, text: squash(visibleText(block)) }))
    .filter(({ text }) => text !== '')
  const body = blocks.reduce<{ block: Element; text: string } | null>(
    (longest, next) =>
      longest === null || next.text.length > longest.text.length ? next : longest,
    null,
  )
  if (body === null) return null
  const age = blocks.find(({ text }) => AGE.test(text))?.text ?? null
  // The call to action is a link outside the body; links inside the body are part of its text.
  const action = Array.from(card.querySelectorAll('a[href]')).find(
    (link) => !body.block.contains(link),
  )
  return {
    text: bodyText(body.block),
    publishedAt: null,
    relativeAge: age,
    hasMedia: card.querySelector('img, video, [style*="background-image"]') !== null,
    link: action?.getAttribute('href') ?? null,
    // Offers and events carry their own labels on a full Updates tab, not seen on a saved page.
    kind: 'unknown',
  }
}

/** The body as written, keeping the owner's line breaks. */
function bodyText(block: Element): string {
  return visibleText(block)
    .split('\n')
    .map((line) => line.replace(/[ \t  ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
