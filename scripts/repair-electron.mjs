#!/usr/bin/env node
import { existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const electronDir = join(root, 'node_modules', 'electron')
const pathFile = join(electronDir, 'path.txt')

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log('Repairing Electron install…')

if (existsSync(electronDir)) {
  rmSync(electronDir, { recursive: true, force: true })
}

run('npm', ['install', 'electron@^40.2.1', '--no-save'])

if (!existsSync(pathFile)) {
  console.error('\nElectron download still failed.')
  console.error('Check internet access to GitHub releases, then retry:')
  console.error('  npm run repair:electron')
  process.exit(1)
}

console.log('\nElectron repaired. Start the app with:')
console.log('  npm start')
