#!/usr/bin/env node
// Build a Tauri-updater-compatible `latest.json` from the artifacts already
// present under `release/windows/` and `release/linux/`.
//
// The Tauri updater manifest format is documented at
// https://v2.tauri.app/plugin/updater/. Each platform block needs a `url` and
// a `signature`; we read the `.sig` sidecar that `tauri build` writes next to
// the updater artifact. If a sidecar is missing we emit an empty string so the
// file is still valid JSON — the caller can fill it in or re-build with
// signing enabled.
//
// Linux updater artifact is the `*.AppImage.tar.gz` (Tauri updater does not
// currently auto-install `.deb`/`.rpm`). Windows updater artifact is the
// NSIS `*-setup.nsis.zip` or MSI `*-setup.msi.zip`.
//
// Usage:
//   node scripts/generate-latest.mjs \
//     --version 1.0.7 \
//     --notes "Release notes" \
//     --base-url https://github.com/owenpkent/MacroVox/releases/download/v1.0.7
// Writes `release/latest.json`.

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, a) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), a[i + 1]])
    return acc
  }, [])
)

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

// Default version from tauri.conf.json if not supplied.
const confPath = join(repoRoot, 'src-tauri', 'tauri.conf.json')
const conf = JSON.parse(readFileSync(confPath, 'utf8'))
const version = args.version || conf.version
const notes = args.notes || `MacroVox ${version}`
const baseUrl =
  args['base-url'] ||
  `https://github.com/owenpkent/MacroVox/releases/download/v${version}`

/** Return first file in `dir` matching `rx`, or null. */
function findFirst(dir, rx) {
  if (!existsSync(dir)) return null
  return readdirSync(dir).find((f) => rx.test(f)) || null
}

/** Read `<artifact>.sig` next to the artifact, if present. */
function readSignature(dir, file) {
  if (!file) return ''
  const sigPath = join(dir, `${file}.sig`)
  return existsSync(sigPath) ? readFileSync(sigPath, 'utf8').trim() : ''
}

const winDir = join(repoRoot, 'release', 'windows')
const linuxDir = join(repoRoot, 'release', 'linux')

const winArtifact =
  findFirst(winDir, /-setup\.nsis\.zip$/) ||
  findFirst(winDir, /-setup\.msi\.zip$/)
const linuxArtifact = findFirst(linuxDir, /\.AppImage\.tar\.gz$/)

const platforms = {}
if (winArtifact) {
  platforms['windows-x86_64'] = {
    signature: readSignature(winDir, winArtifact),
    url: `${baseUrl}/${winArtifact}`,
  }
}
if (linuxArtifact) {
  platforms['linux-x86_64'] = {
    signature: readSignature(linuxDir, linuxArtifact),
    url: `${baseUrl}/${linuxArtifact}`,
  }
}

if (Object.keys(platforms).length === 0) {
  console.error(
    'No updater artifacts found. Expected:\n' +
      `  ${winDir}/*-setup.nsis.zip  (or .msi.zip)\n` +
      `  ${linuxDir}/*.AppImage.tar.gz`
  )
  process.exit(1)
}

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms,
}

const outPath = join(repoRoot, 'release', 'latest.json')
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Wrote ${outPath}`)
console.log(JSON.stringify(manifest, null, 2))
