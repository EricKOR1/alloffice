import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SCRIPT = resolve(__dirname, '../pack-tarball.mjs')

/** The app's resources layout, with placeholder bytes: the packer only checks presence. */
function resources(): string {
  const dir = mkdtempSync(join(tmpdir(), 'alloffice-pack-'))
  const files = [
    'cli/alloffice',
    'cli/genoffice.cjs',
    'cli/package.json',
    'cli/node_modules/jsdom/package.json',
    'cli/skills/alloffice/SKILL.md',
    'wasm/pdfium.wasm',
    'wasm/rhwp_bg.wasm',
    'wasm/hb-subset.wasm',
    'native/xlsx-sidecar',
  ]
  for (const file of files) {
    mkdirSync(dirname(join(dir, file)), { recursive: true })
    writeFileSync(join(dir, file), file.endsWith('alloffice') ? '#!/bin/sh\n' : 'placeholder')
  }
  return dir
}

function notices(): string {
  const dir = mkdtempSync(join(tmpdir(), 'alloffice-notices-'))
  for (const name of ['LICENSE', 'NOTICE', 'THIRD-PARTY-NOTICES.txt']) {
    writeFileSync(join(dir, name), `${name}\n`)
  }
  return dir
}

function pack(from: string, out: string, extra: string[] = []): void {
  execFileSync(
    process.execPath,
    [
      SCRIPT,
      '--from',
      from,
      '--out',
      out,
      '--platform',
      'linux',
      '--arch',
      'x64',
      '--notices',
      notices(),
      ...extra,
    ],
    { env: { ...process.env, GENOFFICE_APP_VERSION: '9.9.9' }, stdio: 'pipe' },
  )
}

describe('pack-tarball', () => {
  it('lays out the same resources the installed app ships, plus the notices', () => {
    const out = mkdtempSync(join(tmpdir(), 'alloffice-dist-'))
    pack(resources(), out)
    const archive = join(out, 'alloffice-cli_9.9.9_linux-x64.tar.gz')

    const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })
      .replace(/\r/g, '')
      .trim()
      .split('\n')
    for (const entry of [
      'alloffice-cli/cli/alloffice',
      'alloffice-cli/cli/genoffice.cjs',
      'alloffice-cli/cli/node_modules/jsdom/package.json',
      'alloffice-cli/cli/skills/alloffice/SKILL.md',
      'alloffice-cli/wasm/pdfium.wasm',
      'alloffice-cli/wasm/rhwp_bg.wasm',
      'alloffice-cli/wasm/hb-subset.wasm',
      'alloffice-cli/native/xlsx-sidecar',
      'alloffice-cli/LICENSE',
      'alloffice-cli/NOTICE',
      'alloffice-cli/THIRD-PARTY-NOTICES.txt',
    ]) {
      expect(entries).toContain(entry)
    }
  })

  it('writes the checksum beside the archive', () => {
    const out = mkdtempSync(join(tmpdir(), 'alloffice-dist-'))
    pack(resources(), out)
    const archive = join(out, 'alloffice-cli_9.9.9_linux-x64.tar.gz')
    const digest = createHash('sha256').update(readFileSync(archive)).digest('hex')
    expect(readFileSync(`${archive}.sha256`, 'utf8')).toBe(
      `${digest}  alloffice-cli_9.9.9_linux-x64.tar.gz\n`,
    )
  })

  it('refuses to pack a half-built app', () => {
    const from = resources()
    rmSync(join(from, 'wasm/hb-subset.wasm'))
    const out = mkdtempSync(join(tmpdir(), 'alloffice-dist-'))
    const run = spawnSync(
      process.execPath,
      [SCRIPT, '--from', from, '--out', out, '--notices', notices()],
      { env: { ...process.env, GENOFFICE_APP_VERSION: '9.9.9' }, encoding: 'utf8' },
    )
    expect(run.status).not.toBe(0)
    expect(run.stderr).toContain('resources are missing: wasm/hb-subset.wasm')
  })
})
