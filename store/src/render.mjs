// Renders the Chrome Web Store images into store/images: five 1280x800 screenshots, each a side
// panel photographed in demo mode (saved fixtures, so no tab visits Google) on the branded canvas
// of screenshot.html, and the 440x280 promo tile from promo.html.
//
//   npm run build:e2e -w extension && node store/src/render.mjs
//
// PLAYWRIGHT_CORE and CHROMIUM override where playwright-core and the browser are found.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const images = resolve(here, '../images')
const extension = resolve(here, '../../extension/.output/chrome-mv3-e2e')
const { chromium } = await import(
  process.env.PLAYWRIGHT_CORE ??
    '/home/shefali/.npm/_npx/2334a3ea0ef73d73/node_modules/playwright-core/index.mjs'
)
const executablePath =
  process.env.CHROMIUM ?? '/home/shefali/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'

/** Each screenshot: its headline and line, and how to bring the panel to the screen it shows. */
const SCENES = [
  {
    file: '1-audit.png',
    headline: 'Audit any Business Profile in one click',
    line:
      'Open a business in Google Maps. Local SEO checks its profile, categories, photos, ' +
      'reviews, posts and website against 39 checks, free, in your own browser.',
    show: async (panel) => {
      const screen = await tab(panel, 'This business')
      await screen.getByRole('heading', { name: 'Profile checklist' }).waitFor()
    },
  },
  {
    file: '2-categories.png',
    headline: 'Every category, on every business',
    line:
      'Scan any Maps search for the category each business ranks with, label the result ' +
      'cards on the map, and see the secondary categories Maps never shows.',
    show: async (panel) => {
      const screen = await tab(panel, 'Local scan')
      await screen.getByRole('button', { name: 'Scan this page' }).click()
      await screen.getByRole('heading', { name: 'Categories in use' }).waitFor()
      await panel.evaluate(() => window.scrollTo(0, 0))
    },
  },
  {
    file: '3-rankings.png',
    headline: 'See where you rank from any street',
    line:
      'Search Maps as if you stood anywhere, or run a geo-grid of searches around the ' +
      'business to see where it wins and where it drops.',
    show: async (panel) => {
      const screen = await tab(panel, 'Rankings')
      await screen.getByRole('button', { name: 'Run free grid' }).click()
      await screen.getByRole('grid', { name: /^Rank at each grid point/ }).waitFor()
      // The whole card is taller than the panel; from the source switch down, the grid and its
      // legend fit.
      await showFromTop(screen.getByRole('group', { name: 'Where the searches run' }))
    },
  },
  {
    file: '4-reviews.png',
    headline: 'Reviews, read the way an owner should',
    line:
      'The monthly trend, the star mix, reply rate and speed, unanswered negative reviews and ' +
      'what reviewers keep mentioning.',
    show: async (panel) => {
      const screen = await tab(panel, 'Reviews')
      await sectionTop(screen, 'Trend')
    },
  },
  {
    file: '5-agents.png',
    headline: 'Your coding agent can run the whole audit',
    line:
      'A local MCP server and nine skills let Claude Code, Codex and Cursor run the same ' +
      'audits through your browser. Your keys never leave the extension.',
    show: async (panel) => {
      await panel.getByRole('button', { name: 'Model: ready. Open settings.' }).click()
      const settings = panel.getByRole('region', { name: 'Settings' })
      await sectionTop(settings, 'Agent connection')
    },
  },
]

async function tab(panel, name) {
  await panel.evaluate(() => document.getElementById('demo-room')?.remove())
  await panel.getByRole('tab', { name, exact: true }).click()
  const screen = panel.getByRole('tabpanel', { name, exact: true })
  await screen.waitFor()
  await panel.evaluate(() => window.scrollTo(0, 0))
  return screen
}

/**
 * Puts `element` a little below the top of the panel, with room added below the page when it ends
 * too soon to scroll that far, so nothing is cut off at the top.
 */
async function showFromTop(element) {
  await element.waitFor()
  await element.evaluate((target) => {
    const top = target.getBoundingClientRect().top + window.scrollY - 12
    const room = document.getElementById('demo-room') ?? document.createElement('div')
    room.id = 'demo-room'
    document.body.append(room)
    const short = top + window.innerHeight - document.documentElement.scrollHeight
    room.style.height = `${Math.max(0, short)}px`
    window.scrollTo(0, top)
  })
}

const sectionTop = (screen, heading) =>
  showFromTop(screen.getByRole('heading', { name: heading }).locator('xpath=ancestor::section[1]'))

const shots = mkdtempSync(join(tmpdir(), 'lseo-store-'))
const context = await chromium.launchPersistentContext(join(shots, 'profile'), {
  executablePath,
  headless: true,
  colorScheme: 'light',
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
})
try {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
  const id = new URL(worker.url()).host
  const panel = await context.newPage()
  await panel.setViewportSize({ width: 400, height: 720 })
  await panel.goto(`chrome-extension://${id}/sidepanel.html?demo`)
  await panel.getByRole('list', { name: 'Connections' }).waitFor()
  // The free grid and the scan run before their screens are shown, as a user would.
  const rankings = await tab(panel, 'Rankings')
  await rankings.getByRole('button', { name: 'Check rank' }).click()
  await rankings.getByRole('table', { name: 'Results at that point' }).waitFor()

  const canvas = await context.newPage()
  await canvas.setViewportSize({ width: 1280, height: 800 })
  for (const scene of SCENES) {
    await scene.show(panel)
    const shot = join(shots, scene.file)
    await panel.screenshot({ path: shot, animations: 'disabled' })
    const query = new URLSearchParams({
      headline: scene.headline,
      line: scene.line,
      shot: pathToFileURL(shot).href,
    })
    await canvas.goto(`${pathToFileURL(join(here, 'screenshot.html')).href}?${query}`)
    await canvas.evaluate(() => document.fonts.ready)
    await canvas.screenshot({ path: join(images, scene.file) })
    console.log(`wrote store/images/${scene.file}`)
  }

  await canvas.setViewportSize({ width: 440, height: 280 })
  await canvas.goto(pathToFileURL(join(here, 'promo.html')).href)
  await canvas.evaluate(() => document.fonts.ready)
  await canvas.screenshot({ path: join(images, 'promo-small-440x280.png') })
  console.log('wrote store/images/promo-small-440x280.png')
} finally {
  await context.close()
}
