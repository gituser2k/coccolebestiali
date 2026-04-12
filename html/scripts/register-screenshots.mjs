import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const outDir = path.resolve(process.cwd(), 'screenshots')
fs.mkdirSync(outDir, { recursive: true })

const viewports = [
  { w: 3840, h: 2160, name: '3840x2160' },
  { w: 1920, h: 1080, name: '1920x1080' },
  { w: 1366, h: 768, name: '1366x768' },
  { w: 1024, h: 1366, name: '1024x1366' },
]

const zooms = [100, 125]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

for (const vp of viewports) {
  await page.setViewportSize({ width: vp.w, height: vp.h })
  for (const z of zooms) {
    await page.goto('http://localhost/register', { waitUntil: 'networkidle' })
    await page.evaluate((zoom) => {
      document.body.style.zoom = `${zoom}%`
    }, z)
    await page.waitForTimeout(700)

    const file = path.join(outDir, `register-${vp.name}-${z}.png`)
    await page.screenshot({ path: file })
    console.log(file)
  }
}

await browser.close()
