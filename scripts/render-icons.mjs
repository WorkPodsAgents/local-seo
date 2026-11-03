// Renders the extension's PNG icons from extension/assets/icon.svg, the one source of the icon,
// at every size the manifest names. Run it after changing the SVG and commit the PNGs.
//
//   node scripts/render-icons.mjs
//
// PLAYWRIGHT_CORE and CHROMIUM override where playwright-core and the browser are found.
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZES = [16, 32, 48, 128, 512]

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svg = await readFile(join(root, 'extension/assets/icon.svg'), 'utf8')
const { chromium } = await import(
  process.env.PLAYWRIGHT_CORE ??
    '/home/shefali/.npm/_npx/2334a3ea0ef73d73/node_modules/playwright-core/index.mjs'
)
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM ??
    '/home/shefali/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
})
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    const sized = svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)
    await page.setContent(`<style>*{margin:0}svg{display:block}</style>${sized}`)
    const file = join(root, `extension/public/icon-${size}.png`)
    await page.screenshot({ path: file, omitBackground: true })
    await page.close()
    console.log(`wrote ${file}`)
  }
} finally {
  await browser.close()
}
