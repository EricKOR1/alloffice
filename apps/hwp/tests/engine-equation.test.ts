/**
 * Equation drawing in the patched rhwp engine (vendor/rhwp-core patch 0041),
 * with a chemistry exam's script: Hangul's ` (a quarter space) and ~ (a space)
 * right after `rm`/`it` are spacing, not letters, and `rm` keeps the following
 * letters upright until the next font command.
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

const SCRIPT =
  'a` rm Cu``+`` it b` rm NO _{3}^{-} it ``+``c` rm H ^{+} ``` rarrow  ``` it `a` rm Cu ^{2+} it ``+``b` rm NO it ``+``d` rm H _{2} O'

/** The glyph text of an equation preview, in drawing order. */
function glyphs(svg: string): string {
  return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join('')
}

describe('equation spacing symbols', () => {
  it('draws no ` or ~ of the exam formula as a letter', () => {
    const doc = HwpDocument.createEmpty()
    doc.createBlankDocument()
    const svg = doc.renderEquationPreview(SCRIPT, 1100, 0)
    const text = glyphs(svg)
    expect(text).toContain('Cu')
    expect(text).not.toContain('`')
    expect(doc.renderEquationPreview('rm A ~ B ~~ C', 1100, 0)).not.toMatch(/>~</)
  })

  it('reads +- and -+ as ± and ∓, and all-caps Greek names as capital letters', () => {
    const doc = HwpDocument.createEmpty()
    doc.createBlankDocument()
    expect(glyphs(doc.renderEquationPreview('a +- b -+ c', 1100, 0))).toContain('a±b∓c')
    expect(glyphs(doc.renderEquationPreview('ALPHA BETA', 1100, 0))).toContain('ΑΒ')
  })
})
