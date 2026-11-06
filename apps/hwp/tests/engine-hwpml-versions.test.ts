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
    // an ellipse is not read from HWPML yet: the app refuses to save such a document
    const withEllipse = new TextDecoder()
      .decode(hwpml('2.7'))
      .replace('<CHAR>abc</CHAR>', '<CHAR>abc</CHAR><ELLIPSE></ELLIPSE>')
    expect(withEllipse).toContain('<ELLIPSE')
    const doc = new HwpDocument(new TextEncoder().encode(withEllipse))
    expect(hmlSkippedObjectCount(doc.getHmlOpenMetadata())).toBe(1)
    expect(hmlSkippedObjectCount(new HwpDocument(hwpml('2.7')).getHmlOpenMetadata())).toBe(0)
  })

  it('reads a footer with a rule and a page number (patch 0035)', () => {
    const footer =
      '<FOOTER ApplyPageType="Both"><PARALIST LineWrap="Break" VertAlign="Bottom">' +
      '<P ParaShape="0" Style="0"><TEXT CharShape="0">' +
      '<LINE EndX="100" EndY="100" IsReverseHV="false" StartX="0" StartY="0">' +
      '<SHAPEOBJECT InstId="1" Lock="false" NumberingType="Figure" ZOrder="0">' +
      '<SIZE Height="1" HeightRelTo="Absolute" Protect="false" Width="30000" ' +
      'WidthRelTo="Absolute"/><POSITION AffectLSpacing="false" AllowOverlap="true" ' +
      'FlowWithText="false" HoldAnchorAndSO="false" HorzAlign="Left" HorzOffset="0" ' +
      'HorzRelTo="Para" TreatAsChar="true" VertAlign="Top" VertOffset="0" VertRelTo="Para"/>' +
      '</SHAPEOBJECT><DRAWINGOBJECT><SHAPECOMPONENT CurHeight="1" CurWidth="30000" ' +
      'GroupLevel="0" OriHeight="100" OriWidth="100" XPos="0" YPos="0"/><LINESHAPE ' +
      'Alpha="0" Color="0" EndCap="Flat" Style="Solid" Width="227"/></DRAWINGOBJECT></LINE>' +
      '<AUTONUM Number="1" NumberType="Page"><AUTONUMFORMAT Superscript="false" ' +
      'Type="Digit"/></AUTONUM><CHAR/></TEXT></P></PARALIST></FOOTER>'
    const xml = new TextDecoder()
      .decode(hwpml('2.7'))
      .replace('<CHAR>abc</CHAR>', `<CHAR>abc</CHAR>${footer}`)
    const doc = new HwpDocument(new TextEncoder().encode(xml))
    expect(hmlSkippedObjectCount(doc.getHmlOpenMetadata())).toBe(0)
    // the rule is drawn in the footer area, below the body text. The page number after it is
    // not drawn yet: the layout puts it in place by finding two spaces in the run, which the
    // rule's own run boundary splits (a known limit, README of vendor/rhwp-core)
    const svg = doc.renderPageSvg(0)
    const rule = [...svg.matchAll(/<line\b[^>]*\by1="([\d.]+)"[^>]*\bx2="([\d.]+)"/g)].map((m) =>
      Number(m[1]),
    )
    const texts = [...svg.matchAll(/<text[^>]*\by="([\d.]+)"/g)].map((m) => Number(m[1]))
    expect(Math.max(...rule)).toBeGreaterThan(Math.max(...texts))
  })

  it('reads its pictures and a group holding one picture (patch 0034)', () => {
    const PNG =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const picture = (shapeObject: boolean, item: number) =>
      '<PICTURE Reverse="false">' +
      (shapeObject
        ? '<SHAPEOBJECT InstId="7" Lock="false" NumberingType="Figure" ZOrder="3">' +
          '<SIZE Height="2000" HeightRelTo="Absolute" Protect="false" Width="3000" ' +
          'WidthRelTo="Absolute"/><POSITION AffectLSpacing="false" AllowOverlap="false" ' +
          'FlowWithText="true" HoldAnchorAndSO="false" HorzAlign="Left" HorzOffset="0" ' +
          'HorzRelTo="Para" TreatAsChar="true" VertAlign="Top" VertOffset="0" ' +
          'VertRelTo="Para"/></SHAPEOBJECT>'
        : '') +
      '<SHAPECOMPONENT GroupLevel="0" OriHeight="2000" OriWidth="3000" XPos="0" YPos="0"/>' +
      '<IMAGERECT X0="0" X1="3000" X2="3000" X3="0" Y0="0" Y1="0" Y2="2000" Y3="2000"/>' +
      '<IMAGECLIP Bottom="2000" Left="0" Right="3000" Top="0"/>' +
      '<INSIDEMARGIN Bottom="0" Left="0" Right="0" Top="0"/>' +
      `<IMAGE Alpha="0" BinItem="${item}" Bright="0" Contrast="0" Effect="RealPic"/></PICTURE>`
    const group =
      '<CONTAINER><SHAPEOBJECT InstId="8" Lock="false" NumberingType="Figure" ZOrder="4">' +
      '<SIZE Height="1000" HeightRelTo="Absolute" Protect="false" Width="1500" ' +
      'WidthRelTo="Absolute"/><POSITION AffectLSpacing="false" AllowOverlap="false" ' +
      'FlowWithText="true" HoldAnchorAndSO="false" HorzAlign="Left" HorzOffset="0" ' +
      'HorzRelTo="Para" TreatAsChar="true" VertAlign="Top" VertOffset="0" VertRelTo="Para"/>' +
      '</SHAPEOBJECT><SHAPECOMPONENT CurHeight="1000" CurWidth="1500" GroupLevel="0" ' +
      `OriHeight="1000" OriWidth="1500" XPos="0" YPos="0"/>${picture(false, 2)}</CONTAINER>`
    const xml = new TextDecoder()
      .decode(hwpml('2.7'))
      .replace('<CHAR>abc</CHAR>', `<CHAR>abc</CHAR>${picture(true, 1)}`)
      .replace('<CHAR>456</CHAR>', `<CHAR>456</CHAR>${group}`)
      .replace(
        '<MAPPINGTABLE>',
        '<MAPPINGTABLE><BINDATALIST Count="2"><BINITEM BinData="1" Format="png" ' +
          'Type="Embedding"/><BINITEM BinData="2" Format="png" Type="Embedding"/></BINDATALIST>',
      )
      .replace(
        '<TAIL>',
        `<TAIL><BINDATASTORAGE><BINDATA Encoding="Base64" Id="1">${PNG}</BINDATA>` +
          `<BINDATA Encoding="Base64" Id="2">\n${PNG}\n</BINDATA></BINDATASTORAGE>`,
      )
    const doc = new HwpDocument(new TextEncoder().encode(xml))
    // both pictures are drawn with their image, and nothing was skipped
    const svg = Array.from({ length: doc.pageCount() }, (_, page) => doc.renderPageSvg(page)).join(
      '',
    )
    expect(svg.match(/<image\b/g)?.length).toBe(2)
    expect(hmlSkippedObjectCount(doc.getHmlOpenMetadata())).toBe(0)
    // a document whose objects were all read saves as HWP with its pictures
    const saved = new HwpDocument(doc.exportHwp())
    const savedSvg = Array.from({ length: saved.pageCount() }, (_, page) =>
      saved.renderPageSvg(page),
    ).join('')
    expect(savedSvg.match(/<image\b/g)?.length).toBe(2)
  })

  it('starts two columns where a column definition stands (patch 0037)', () => {
    const coldef =
      '<COLDEF Count="2" Layout="Left" SameGap="3000" SameSize="true" Type="Newspaper"/>'
    const long = '가나다라마바사아자차카타파하'.repeat(6)
    const plain = new TextDecoder()
      .decode(hwpml('2.7'))
      .replace('<CHAR>abc</CHAR>', `<CHAR>${long}</CHAR>`)
    const twoColumns = plain.replace(`<CHAR>${long}</CHAR>`, `${coldef}<CHAR>${long}</CHAR>`)
    // the right end of the long line, against the page's middle
    const rightEnd = (xml: string) => {
      const doc = new HwpDocument(new TextEncoder().encode(xml))
      const svg = doc.renderPageSvg(0)
      const width = Number(svg.match(/viewBox="0 0 ([\d.]+)/)?.[1])
      const xs = [...svg.matchAll(/<text[^>]*\bx="([\d.]+)"[^>]*>([^<]*)</g)]
        .filter((m) => '가나다라마바사아자차카타파하'.includes(m[2]))
        .map((m) => Number(m[1]))
      return Math.max(...xs) / width
    }
    expect(rightEnd(plain)).toBeGreaterThan(0.6)
    expect(rightEnd(twoColumns)).toBeLessThan(0.5)
  })

  it('still refuses a version it does not know', () => {
    expect(() => new HwpDocument(hwpml('9.9'))).toThrow(/HWPML/)
  })
})
