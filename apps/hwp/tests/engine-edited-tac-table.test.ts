/**
 * A form whose whole body is one table treated as a character (rhwp patch 0029). The engine
 * squeezes such a table back to the height the file declares when its content is taller; that
 * is right for a file as Hancom saved it, but once a cell's text grows the rows were pressed
 * so the text ran out of its cell over the rows and the lines below. HWPX had no edit-session
 * exception at all, and a reopened file (HWP too) still declared the old height.
 *
 * The fixture is a public award recommendation form (서식1) with every letter replaced by
 * meaningless ones; cell 38 is its 공적 내용 cell, which an AI request filled with more lines.
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

const FORM = join(__dirname, 'fixtures', 'form-inline-table-grows.hwpx')
/** The form's table: section 0, paragraph 10, its first control. */
const TABLE = { sec: 0, para: 10, control: 0 }
const MERIT_CELL = 38
const LINE = ' - 0000 가가가 가가가 가가가가가 가가가가(가가가가가가)'
const LINES = 8

interface Box {
  cellIdx: number
  pageIndex: number
  x: number
  y: number
  w: number
  h: number
}

function at(k: number): string {
  return JSON.stringify([{ controlIndex: TABLE.control, cellIndex: MERIT_CELL, cellParaIndex: k }])
}

/** The 공적 내용 cell with eight one-line items, as the AI wrote them (delete, then insert). */
function filled(format: 'hwpx' | 'hwp'): HwpDocument {
  let doc = new HwpDocument(readFileSync(FORM))
  if (format === 'hwp') doc = new HwpDocument(doc.exportHwp())
  for (let k = 0; k < LINES; k++) {
    if (k >= 5) {
      doc.splitParagraphInCellByPath(
        TABLE.sec,
        TABLE.para,
        at(k - 1),
        doc.getCellParagraphLengthByPath(TABLE.sec, TABLE.para, at(k - 1)),
      )
    }
    const length = doc.getCellParagraphLengthByPath(TABLE.sec, TABLE.para, at(k))
    if (length > 0) doc.deleteTextInCellByPath(TABLE.sec, TABLE.para, at(k), 0, length)
    doc.insertTextInCellByPath(TABLE.sec, TABLE.para, at(k), 0, LINE)
  }
  return doc
}

function cells(doc: HwpDocument): Box[] {
  return JSON.parse(doc.getTableCellBboxes(TABLE.sec, TABLE.para, TABLE.control))
}

/** Baselines of the text lines drawn on a page within a box's columns, top to bottom. */
function baselines(doc: HwpDocument, box: Box): number[] {
  const ys = new Set<number>()
  for (const m of doc
    .renderPageSvg(box.pageIndex)
    .matchAll(/<text[^>]*\bx="([\d.]+)"[^>]*\by="([\d.]+)"/g)) {
    const x = Number(m[1])
    if (x > box.x && x < box.x + box.w) ys.add(Number(m[2]))
  }
  return [...ys].sort((a, b) => a - b)
}

describe.each(['hwpx', 'hwp'] as const)('a grown cell of an inline form table (%s)', (format) => {
  it('makes the row tall enough for its lines instead of pressing it', () => {
    const doc = filled(format)
    const merit = cells(doc).find((c) => c.cellIdx === MERIT_CELL)!
    const inside = baselines(doc, merit).filter((y) => y > merit.y && y < merit.y + merit.h)
    // every item line (and nothing of the row below) sits inside the cell
    expect(inside).toHaveLength(LINES)
    const below = cells(doc).find((c) => c.cellIdx === MERIT_CELL + 1)!
    expect(below.y).toBeGreaterThanOrEqual(merit.y + merit.h - 0.5)
  })

  it('draws the same after saving and opening again', () => {
    const doc = filled(format)
    const again = new HwpDocument(format === 'hwp' ? doc.exportHwp() : doc.exportHwpx())
    const pick = (d: HwpDocument) =>
      cells(d).map(({ cellIdx, pageIndex, y, h }) => [
        cellIdx,
        pageIndex,
        Math.round(y),
        Math.round(h),
      ])
    expect(pick(again)).toEqual(pick(doc))
    expect(again.pageCount()).toBe(doc.pageCount())
  })

  it('leaves the form as it was when nothing is edited', () => {
    const doc = new HwpDocument(readFileSync(FORM))
    const before = cells(doc).map(({ y, h }) => [Math.round(y), Math.round(h)])
    const again = new HwpDocument(doc.exportHwpx())
    expect(cells(again).map(({ y, h }) => [Math.round(y), Math.round(h)])).toEqual(before)
  })
})
