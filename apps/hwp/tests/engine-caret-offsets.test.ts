/**
 * The engine's caret places (decision 0050): clicks and caret boxes count an
 * inline object — an equation here — as one place, the same count as
 * `getLogicalLength` and `logicalToTextOffset`, which the studio's bridge uses
 * to reach the character calls (apps/hwp/scripts/rhwp-patch-logical-caret.mjs).
 * The paragraph is built in the test: "앞 글자 뒤 글자" with an equation after
 * "앞 " and the last two words bold, so the text after the equation is split
 * into a run that holds the equation and a run that does not — the shape of an
 * exam's "(가) 밀도가 [d] g/mL인 …" line, where clicks went one place off.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import init, { HwpDocument } from '@rhwp/core'

const require = createRequire(import.meta.url)
const CORE = dirname(require.resolve('@rhwp/core'))

beforeAll(async () => {
  await init({ module_or_path: readFileSync(join(CORE, 'rhwp_bg.wasm')) })
})

interface Node {
  type: string
  text?: string
  pi?: number
  bbox: { x: number; y: number; w: number; h: number }
  children?: Node[]
}

function build() {
  const doc = HwpDocument.createEmpty()
  doc.createBlankDocument()
  doc.insertText(0, 0, 0, '앞 글자 뒤 글자')
  doc.insertEquation(0, 0, 2, 'x^2', 1000, 0)
  doc.applyCharFormat(0, 0, 5, 9, JSON.stringify({ bold: true }))
  const runs: Node[] = []
  const walk = (node: Node) => {
    if (node.type === 'TextRun' && node.pi === 0 && node.text) runs.push(node)
    for (const child of node.children ?? []) walk(child)
  }
  walk(JSON.parse(doc.getPageRenderTree(0)) as Node)
  return { doc, runs }
}

const hit = (doc: HwpDocument, x: number, y: number) =>
  JSON.parse(doc.hitTest(0, x, y)) as { paragraphIndex: number; charOffset: number }

describe('caret places after an inline equation', () => {
  it('splits the text into the runs the case needs', () => {
    const { doc, runs } = build()
    expect(doc.getParagraphLength(0, 0)).toBe(9)
    expect(doc.getLogicalLength(0, 0)).toBe(10)
    expect(runs.map((run) => run.text)).toEqual(['앞 ', '글자 ', '뒤 글자'])
  })

  it('puts a click past the line end at the paragraph end, in caret places', () => {
    const { doc, runs } = build()
    const last = runs[runs.length - 1]
    const at = hit(doc, last.bbox.x + last.bbox.w + 40, last.bbox.y + last.bbox.h / 2)
    expect(at.charOffset).toBe(doc.getLogicalLength(0, 0))
    expect(doc.logicalToTextOffset(0, 0, at.charOffset)).toBe(doc.getParagraphLength(0, 0))
  })

  it('counts the equation in the bold run after it too', () => {
    const { doc, runs } = build()
    const bold = runs[2]
    // just inside the run's first letter: the place before "뒤"
    const at = hit(doc, bold.bbox.x + 1, bold.bbox.y + bold.bbox.h / 2)
    expect(at.charOffset).toBe(6)
    expect(doc.logicalToTextOffset(0, 0, at.charOffset)).toBe(5)
    const box = JSON.parse(doc.getCursorRect(0, 0, 6)) as { x: number }
    expect(Math.abs(box.x - bold.bbox.x)).toBeLessThan(1)
  })
})
