import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { resolveUnderBase } from '../scripts/safe-path.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

describe('resolveUnderBase', () => {
  it('keeps legitimate in-tree paths under the repo root', () => {
    assert.equal(
      resolveUnderBase(root, 'demo/recording.html'),
      join(root, 'demo', 'recording.html')
    )
    assert.equal(
      resolveUnderBase(root, '/demo/recording.html'),
      join(root, 'demo', 'recording.html')
    )
    assert.equal(
      resolveUnderBase(root, 'renderer/styles.css'),
      join(root, 'renderer', 'styles.css')
    )
    assert.equal(resolveUnderBase(root, '/shared/seed.json'), join(root, 'shared', 'seed.json'))
    assert.equal(
      resolveUnderBase(root, 'demo/../renderer/styles.css'),
      join(root, 'renderer', 'styles.css')
    )
  })

  it('maps URL-style absolute pathnames onto the repo instead of the host root', () => {
    assert.equal(resolveUnderBase(root, '/etc/passwd'), join(root, 'etc', 'passwd'))
  })

  it('rejects relative traversal that escapes the base directory', () => {
    assert.equal(resolveUnderBase(root, '../package.json'), null)
    assert.equal(resolveUnderBase(root, '/../package.json'), null)
    assert.equal(resolveUnderBase(root, '/../../etc/passwd'), null)
    assert.equal(resolveUnderBase(root, 'demo/../../etc/passwd'), null)
    assert.equal(resolveUnderBase(root, '/demo/../../../etc/passwd'), null)
    assert.equal(resolveUnderBase(root, decodeURIComponent('%2e%2e/%2e%2e/etc/passwd')), null)
  })

  it('rejects NUL bytes', () => {
    assert.equal(resolveUnderBase(root, 'demo/\0recording.html'), null)
  })
})
