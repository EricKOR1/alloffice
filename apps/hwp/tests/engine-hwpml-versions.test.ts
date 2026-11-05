/**
 * HWPML (the XML form of a Hangul document, often named .hml but also passed around as .hwp)
 * of any 2.x version opens (rhwp patch 0030). The engine reads every version the same way, by
 * tag, but its gate let in only 2.1, 2.9 and 2.91, so a school form saved as HWPML 2.7 failed
 * with "지원하지 않는 HWPML 버전입니다: 2.7". The same form also wrote a negative number where
 * the engine keeps an unsigned one (patch 0031).
 *
 * The fixture is rhwp's `samples/hml/formatting_table.hml` (from osik-kwon/osk_filter,
 * Unlicense), a Hancom HML export of version 2.91; each case stamps another version on it.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import init, { HwpDocument } from '@rhwp/core'
import { hmlSkippedObjectCount } from '../studio-plugin/agent-plugin.mjs'

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

/** The width the first table of a document draws at. */
function firstTableWidth(xml: string): number {
  const doc = new HwpDocument(new TextEncoder().encode(xml))
  for (let para = 0; para < doc.getParagraphCount(0); para++) {
    try {
      return (JSON.parse(doc.getTableBBox(0, para, 0)) as { width: number }).width
    } catch {
      // no table in this paragraph
    }
  }
  throw new Error('no table')
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

  it('reads a negative number in a field kept unsigned, as the binary HWP does', () => {
    // a flipped rectangle of a school form (HWPML 2.7) stores its current height as -1566;
    // patch 0031 reads it as the same bits instead of refusing the whole document
    const flipped = new TextDecoder()
      .decode(hwpml('2.7'))
      .replace('<SHAPECOMPONENT GroupLevel="0"', '<SHAPECOMPONENT CurHeight="-1566" GroupLevel="0"')
    expect(flipped).toContain('CurHeight="-1566"')
    const doc = new HwpDocument(new TextEncoder().encode(flipped))
    const reference = new HwpDocument(hwpml('2.7'))
    expect(texts(doc)).toEqual(['123456', 'abcefg'])
    expect(doc.pageCount()).toBe(reference.pageCount())
  })

  it('reads a table sized as a share of the column at its cells width (patch 0032)', () => {
    // HWPML 2.7 writes a column-wide table as Width="100" WidthRelTo="Column"
    const tableWidth = firstTableWidth
    const absolute = new TextDecoder().decode(hwpml('2.7'))
    const relative = absolute.replace(
      /(<TABLE\b[\s\S]*?<SIZE\b[^>]*?)Width="\d+"([^>]*?)WidthRelTo="Absolute"/,
      '$1Width="100"$2WidthRelTo="Column"',
    )
    expect(relative).toContain('WidthRelTo="Column"')
    expect(tableWidth(relative)).toBeGreaterThan(100)
    expect(tableWidth(relative)).toBeCloseTo(tableWidth(absolute), 0)
  })

  it('keeps a table its own size when an equation sits in a cell (patch 0033)', () => {
    // the equation's own SIZE (525 wide) used to become the table's width
    const tableWidth = firstTableWidth
    const plain = new TextDecoder().decode(hwpml('2.7'))
    const cell = plain.indexOf('<CELL ')
    const text = plain.indexOf('<CHAR>', cell)
    const equation =
      '<EQUATION BaseLine="86" BaseUnit="1000" LineMode="false" TextColor="0" ' +
      'Version="Equation Version 60"><SHAPEOBJECT InstId="1" Lock="false" ' +
      'NumberingType="Equation" ZOrder="9"><SIZE Height="975" HeightRelTo="Absolute" ' +
      'Protect="false" Width="525" WidthRelTo="Absolute"/></SHAPEOBJECT>' +
      '<SCRIPT>a</SCRIPT></EQUATION>'
    const withEquation = plain.slice(0, text) + equation + plain.slice(text)
    expect(tableWidth(withEquation)).toBeCloseTo(tableWidth(plain), 0)
  })

  it('counts the objects it skipped, which a save would drop', () => {
    // a picture is not read from HWPML: the app refuses to save such a document
    const withPicture = new TextDecoder()
      .decode(hwpml('2.7'))
      .replace('<CHAR>abc</CHAR>', '<CHAR>abc</CHAR><PICTURE Reverse="false"></PICTURE>')
    expect(withPicture).toContain('<PICTURE')
    const doc = new HwpDocument(new TextEncoder().encode(withPicture))
    expect(hmlSkippedObjectCount(doc.getHmlOpenMetadata())).toBe(1)
    expect(hmlSkippedObjectCount(new HwpDocument(hwpml('2.7')).getHmlOpenMetadata())).toBe(0)
  })

  it('still refuses a version it does not know', () => {
    expect(() => new HwpDocument(hwpml('9.9'))).toThrow(/HWPML/)
  })
})
