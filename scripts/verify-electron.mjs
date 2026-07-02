#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pathFile = join(root, 'node_modules', 'electron', 'path.txt')

if (existsSync(pathFile)) {
  console.log('Electron install looks OK.')
  process.exit(0)
}

console.error('Electron binary missing (no node_modules/electron/path.txt).')
console.error('Run: npm run repair:electron')
process.exit(1)
