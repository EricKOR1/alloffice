/**
 * HWPML (the XML form of a Hangul document, often named .hml but also passed around as .hwp)
 * of any 2.x version opens (rhwp patch 0030). The engine reads every version the same way, by
 * tag, but its gate let in only 2.1, 2.9 and 2.91, so a school form saved as HWPML 2.7 failed
 * with "지원하지 않는 HWPML 버전입니다: 2.7".
 *
 * The fixture is rhwp's `samples/hml/formatting_table.hml` (from osik-kwon/osk_filter,
 * Unlicense), a Hancom HML export of version 2.91; each case stamps another version on it.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import init, { HwpDocument } from '@rhwp/core'

const require = createRequire(import.meta.url)

beforeAll(async () => {
  const wasm = join(dirname(require.resolve('@rhwp/core')), 'rhwp_bg.wasm')
  await init({ module_or_path: readFileSync(wasm) })
})

const SAMPLE = readFileSync(join(__dirname, 'fixtures', 'hwpml-formatting-table.hml'), 'utf8')

/** The sample with its root stamped with `version`. */
function hwpml(version: string): Uint8Array {
  const stamped = SAMPLE.replace(/(<HWPML\b[^>]*\bVersion=")[^"]*"/, `$1${version}"`)
  expect(stamped).toContain(`Version="${version}"`)
  return new TextEncoder().encode(stamped)
}

function texts(doc: HwpDocument): string[] {
  const out: string[] = []
  for (let p = 0; p < doc.getParagraphCount(0); p++) {
    const length = doc.getParagraphLength(0, p)
    out.push(length > 0 ? doc.getTextRange(0, p, 0, length) : '')
  }
  return out
}

describe('HWPML versions', () => {
  it.each(['2.7', '2.5', '2.8', '2.0'])('opens version %s as it opens 2.91', (version) => {
    const doc = new HwpDocument(hwpml(version))
    const reference = new HwpDocument(hwpml('2.91'))
    expect(texts(doc)).toEqual(['123456', 'abcefg'])
    expect(doc.pageCount()).toBe(reference.pageCount())
    expect(doc.renderPageSvg(0)).toBe(reference.renderPageSvg(0))
    // what the app does when the file is named .hwp: it saves the Hangul binary
    expect(texts(new HwpDocument(doc.exportHwp()))).toEqual(texts(doc))
  })

  it('still refuses a version it does not know', () => {
    expect(() => new HwpDocument(hwpml('9.9'))).toThrow(/HWPML/)
  })
})
