#!/usr/bin/env node
/**
 * Records a ~3 minute Cup Pulse demo using Playwright, then encodes to MP4 with FFmpeg.
 * Does not require macOS Screen Recording permission (captures browser viewport).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const demoDir = join(root, 'demo')
const rawDir = join(demoDir, 'raw')
const outputMp4 = join(demoDir, 'cup-pulse-demo.mp4')
const durationSec = 180
const port = 8765

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`)
      let filePath = join(root, decodeURIComponent(url.pathname))
      if (url.pathname === '/') filePath = join(demoDir, 'recording.html')

      import('node:fs').then((fs) => {
        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(404)
            res.end('Not found')
            return
          }
          const ext = filePath.split('.').pop()
          const types = {
            html: 'text/html',
            css: 'text/css',
            js: 'text/javascript',
            mjs: 'text/javascript',
            json: 'application/json'
          }
          res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' })
          res.end(data)
        })
      })
    })

    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

async function record() {
  if (existsSync(rawDir)) rmSync(rawDir, { recursive: true, force: true })
  mkdirSync(rawDir, { recursive: true })

  const server = await startStaticServer()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    recordVideo: { dir: rawDir, size: { width: 1280, height: 900 } }
  })

  const page = await context.newPage()
  await page.goto(`http://127.0.0.1:${port}/demo/recording.html`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.demo?.ready())

  // ~3 minute scripted walkthrough
  await sleep(12_000) // title splash
  await page.evaluate(() => window.demo.hideSplash())
  await sleep(18_000) // dashboard overview

  await page.selectOption('#owner-filter', 'Maya Chen')
  await sleep(15_000)

  await page.selectOption('#owner-filter', 'all')
  await sleep(12_000)

  await page.evaluate(() => window.demo.setPeers(2))
  await sleep(10_000)

  await page.click('#add-prediction')
  await sleep(15_000)

  await page.click('#add-prediction')
  await sleep(18_000)

  await page.selectOption('#owner-filter', 'Jordan Lee')
  await sleep(20_000)

  await page.evaluate(() => window.demo.showOutro())
  await sleep(22_000) // outro + buffer to ~180s

  const video = page.video()
  await page.close()
  await context.close()
  await browser.close()
  server.close()

  const webmPath = await video.path()
  console.log('Recorded WebM:', webmPath)

  const ffmpeg = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      webmPath,
      '-t',
      String(durationSec),
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputMp4
    ],
    { stdio: 'inherit' }
  )

  if (ffmpeg.status !== 0) {
    console.error('FFmpeg encode failed')
    process.exit(ffmpeg.status ?? 1)
  }

  console.log('\nDemo video saved to:', outputMp4)
}

record().catch((err) => {
  console.error(err)
  process.exit(1)
})
