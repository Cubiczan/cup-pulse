import { isAbsolute, resolve, sep } from 'node:path'

/**
 * Resolve `requestedPath` under `baseDir`. Returns null if the path
 * is invalid, contains a NUL, is absolute after sanitizing, or
 * would escape the base directory (including `..` traversal).
 */
export function resolveUnderBase(baseDir, requestedPath) {
  if (typeof requestedPath !== 'string' || requestedPath.includes('\0')) return null

  const base = resolve(baseDir)
  const relative = requestedPath.replace(/^[/\\]+/, '')
  if (relative !== '' && isAbsolute(relative)) return null

  const resolved = resolve(base, relative)
  const prefix = base.endsWith(sep) ? base : base + sep
  if (resolved !== base && !resolved.startsWith(prefix)) return null
  return resolved
}
