// End-to-end run of the e2e build in Chromium, in demo mode: the side panel answers every screen
// from the saved Maps fixtures (src/demo), so no tab visits Google. Opens each tab at the side
// panel's width, runs the action that fills it, and fails on any page or console error. With a
// directory argument it saves a screenshot of every screen there.
//
//   npm run build:e2e && node extension/e2e/smoke.mjs [screenshot-dir]
//
// Branded Chrome ignores --load-extension, so this needs a Chromium build. PLAYWRIGHT_CORE and
// CHROMIUM override where playwright-core and the browser are found.
import { mkdtempSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const shots = process.argv[2] ?? null
const here = dirname(fileURLToPath(import.meta.url))
const extension = resolve(here, '../.output/chrome-mv3-e2e')
const { chromium } = await import(
  process.env.PLAYWRIGHT_CORE ??
    '/home/shefali/.npm/_npx/2334a3ea0ef73d73/node_modules/playwright-core/index.mjs'
)
const executablePath =
  process.env.CHROMIUM ?? '/home/shefali/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'
const PANEL = { width: 400, height: 900 }

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'lseo-')), {
  executablePath,
  headless: true,
  // Twice the pixels, as the Agent Ready screenshots are taken.
  deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
})
const failures = []
const saved = []
try {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
  const id = new URL(worker.url()).host
  if (shots !== null) await mkdir(shots, { recursive: true })
  const shoot = async (page, file, options = {}) => {
    if (shots === null) return
    await page.screenshot({ path: join(shots, file), animations: 'disabled', ...options })
    saved.push(file)
  }
  const watch = (page, name) => {
    page.on('pageerror', (error) => failures.push(`${name} page error: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') failures.push(`${name} console error: ${message.text()}`)
    })
  }

  const panel = await context.newPage()
  watch(panel, 'panel')
  await panel.setViewportSize(PANEL)
  await panel.goto(`chrome-extension://${id}/sidepanel.html?demo`)
  await panel.getByText('Local SEO', { exact: true }).waitFor()
  await panel.getByRole('list', { name: 'Connections' }).waitFor()
  // From a little above the card around a heading to at most a screen below, so the shot starts
  // on a whole card even when the page ends too soon to scroll that card to the top.
  const fromCard = (heading) =>
    heading.evaluate((element, width) => {
      const card = element.closest('section') ?? element
      const y = card.getBoundingClientRect().top + window.scrollY - 12
      const height = Math.min(window.innerHeight, document.documentElement.scrollHeight - y)
      return { x: 0, y, width, height }
    }, PANEL.width)
  const tab = async (name) => {
    await panel.getByRole('tab', { name, exact: true }).click()
    const tabPanel = panel.getByRole('tabpanel', { name, exact: true })
    await tabPanel.waitFor()
    await panel.evaluate(() => window.scrollTo(0, 0))
    return tabPanel
  }

  let screen = await tab('This business')
  await screen.getByRole('heading', { name: 'Profile checklist' }).waitFor()
  await shoot(panel, '01-this-business.png')
  await shoot(panel, '02-this-business-full.png', { fullPage: true })
  await screen.getByRole('button', { name: 'Write a description' }).click()
  await screen.getByRole('textbox', { name: 'Write a description: draft' }).waitFor()
  const writers = await fromCard(screen.getByRole('heading', { name: 'AI writers' }))
  await shoot(panel, '03-ai-writers.png', { fullPage: true, clip: writers })
  await panel.getByRole('button', { name: /^Reviews: / }).click()
  await screen.getByRole('heading', { name: 'Reviews checks' }).waitFor()
  await shoot(panel, '04-group-reviews.png')

  screen = await tab('Local scan')
  await screen.getByRole('button', { name: 'Scan this page' }).click()
  await screen.getByRole('heading', { name: 'Categories in use' }).waitFor()
  await shoot(panel, '05-local-scan.png', { fullPage: true })

  screen = await tab('Rankings')
  await screen.getByRole('button', { name: 'Check rank' }).click()
  await screen.getByRole('table', { name: 'Results at that point' }).waitFor()
  await screen.getByRole('button', { name: 'Run free grid' }).click()
  await screen.getByRole('grid', { name: /^Rank at each grid point/ }).waitFor()
  await shoot(panel, '06-rankings.png', { fullPage: true })
  const grid = await fromCard(screen.getByRole('heading', { name: 'Geo grid' }))
  await shoot(panel, '07-geo-grid.png', { fullPage: true, clip: grid })

  screen = await tab('Reviews')
  await screen.getByRole('heading', { name: 'Trend' }).waitFor()
  await shoot(panel, '08-reviews.png', { fullPage: true })

  screen = await tab('Website')
  await screen.getByRole('button', { name: 'Check again' }).click()
  await screen.getByRole('heading', { name: 'Website checks' }).waitFor()
  await shoot(panel, '09-website.png', { fullPage: true })

  screen = await tab('AI answers')
  await screen.getByRole('button', { name: 'Open the assistants' }).click()
  await screen.getByText('One run is one sample').waitFor()
  await shoot(panel, '10-ai-answers.png', { fullPage: true })

  await panel.getByRole('button', { name: 'Model: ready. Open settings.' }).click()
  await panel.getByRole('region', { name: 'Settings' }).waitFor()
  await shoot(panel, '11-settings.png', { fullPage: true })

  const report = await context.newPage()
  watch(report, 'report')
  await report.setViewportSize({ width: 1280, height: 900 })
  await report.goto(`chrome-extension://${id}/report.html?demo`)
  await report.getByRole('heading', { name: 'Every check' }).waitFor()
  await shoot(report, '12-report.png', { fullPage: true })
} catch (error) {
  failures.push(error instanceof Error ? error.message.split('\n')[0] : String(error))
} finally {
  await context.close()
}
if (shots !== null) console.log(`screenshots in ${shots}: ${saved.join(', ')}`)
if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('smoke: every side panel tab and the report render in demo mode')
