/**
 * studio-logical-caret
 *   The studio's caret speaks one count and its text calls another. Clicks
 *   (`hitTest`), caret boxes (`getCursorRect*`) and arrow keys
 *   (`navigateNextEditable`) count an inline object in the text — an equation,
 *   a picture or a table set as a character — as one place. The text calls
 *   (`insertText`, `deleteText`, `getParagraphLength`, the cell variants…)
 *   count characters only. After an equation in a line, the caret the user
 *   sees is one place left of where a typed letter goes, and a click at the
 *   end of such a line gives a place past the paragraph's character length, so
 *   the studio draws the caret at the line start while letters go to the end
 *   (a chemistry exam's question stems, 2026-11-08).
 *
 *   The studio's caret keeps the object-counting place; its bridge turns it
 *   into the character place on the way into a text call and back on the way
 *   out, and reports paragraph lengths in the caret's count. A letter typed
 *   right after an object in body text goes after it (`insertTextLogical`);
 *   the character place alone cannot tell "after the object" from "before it".
 *   Cells have no such call yet: a letter typed right after an object in a cell
 *   still lands before it. The app's plugins call the engine directly, in
 *   characters, and are not affected.
 */
const GUARD = "    if (!this.doc) throw new Error('문서가 로드되지 않았습니다');"

/** A one-line bridge method whose guard line gains `lines` right after it. */
function afterGuard(signature, lines) {
  return {
    find: [signature, GUARD].join('\n'),
    replace: [signature, GUARD, ...lines].join('\n'),
  }
}

const IDS = 'this.cellIdsPath(controlIdx, cellIdx, cellParaIdx)'

const HELPERS = [
  '',
  '  /** Caret place (an inline object counts as one) → character place in a body paragraph. */',
  '  private bodyTextOffset(sec: number, para: number, offset: number): number {',
  '    try {',
  '      return this.doc!.logicalToTextOffset(sec, para, offset);',
  '    } catch {',
  '      return offset;',
  '    }',
  '  }',
  '',
  '  /** Character place → caret place in a body paragraph. */',
  '  private bodyLogicalOffset(sec: number, para: number, offset: number): number {',
  '    try {',
  '      return this.doc!.textToLogicalOffset(sec, para, offset);',
  '    } catch {',
  '      return offset;',
  '    }',
  '  }',
  '',
  '  /** A caret range in a body paragraph as a character start and count. */',
  '  private bodyTextRange(sec: number, para: number, offset: number, count: number): [number, number] {',
  '    const start = this.bodyTextOffset(sec, para, offset);',
  '    const end = this.bodyTextOffset(sec, para, offset + count);',
  '    return [start, Math.max(0, end - start)];',
  '  }',
  '',
  '  /** A text call result whose `charOffset` is a character place, with the caret place instead. */',
  '  private withBodyLogicalOffset(sec: number, para: number, json: string): string {',
  '    try {',
  '      const result = JSON.parse(json);',
  "      if (result && typeof result.charOffset === 'number') {",
  '        result.charOffset = this.bodyLogicalOffset(sec, para, result.charOffset);',
  '        return JSON.stringify(result);',
  '      }',
  '    } catch {',
  '      // not JSON: hand it back as it came',
  '    }',
  '    return json;',
  '  }',
  '',
  '  private cellIdsPath(controlIdx: number, cellIdx: number, cellParaIdx: number): string {',
  '    return JSON.stringify([{ controlIndex: controlIdx, cellIndex: cellIdx, cellParaIndex: cellParaIdx }]);',
  '  }',
  '',
  '  /** The path of another paragraph of the same cell. */',
  '  private cellParaPath(pathJson: string, cellParaIdx: number): string {',
  '    try {',
  '      const path = JSON.parse(pathJson);',
  '      if (Array.isArray(path) && path.length > 0) {',
  '        path[path.length - 1] = { ...path[path.length - 1], cellParaIndex: cellParaIdx };',
  '        return JSON.stringify(path);',
  '      }',
  '    } catch {',
  '      // fall through',
  '    }',
  '    return pathJson;',
  '  }',
  '',
  '  /** Caret place → character place in a cell paragraph (by path). */',
  '  private cellTextOffset(sec: number, parentPara: number, pathJson: string, offset: number): number {',
  '    const d = this.doc as unknown as { cellLogicalToTextOffsetByPath?: (s: number, p: number, j: string, o: number) => number };',
  "    if (typeof d?.cellLogicalToTextOffsetByPath !== 'function') return offset;",
  '    try {',
  '      return d.cellLogicalToTextOffsetByPath(sec, parentPara, pathJson, offset);',
  '    } catch {',
  '      return offset;',
  '    }',
  '  }',
  '',
  '  /** A caret range in a cell paragraph as a character start and count. */',
  '  private cellTextRange(sec: number, parentPara: number, pathJson: string, offset: number, count: number): [number, number] {',
  '    const start = this.cellTextOffset(sec, parentPara, pathJson, offset);',
  '    const end = this.cellTextOffset(sec, parentPara, pathJson, offset + count);',
  '    return [start, Math.max(0, end - start)];',
  '  }',
  '',
  '  /** A cell paragraph length in caret places, or in characters on an engine without the call. */',
  '  private cellLogicalLength(sec: number, parentPara: number, pathJson: string): number | null {',
  '    const d = this.doc as unknown as { getCellLogicalLengthByPath?: (s: number, p: number, j: string) => number };',
  "    if (typeof d?.getCellLogicalLengthByPath !== 'function') return null;",
  '    try {',
  '      return d.getCellLogicalLengthByPath(sec, parentPara, pathJson);',
  '    } catch {',
  '      return null;',
  '    }',
  '  }',
]

export const LOGICAL_CARET_PATCH = {
  file: /[\\/]rhwp-studio[\\/]src[\\/]core[\\/]wasm-bridge\.ts$/,
  edits: [
    // body: insert, with the place right after an object kept after it
    {
      find: [
        '  insertText(sec: number, para: number, charOffset: number, text: string): string {',
        GUARD,
        '    return this.doc.insertText(sec, para, charOffset, text);',
        '  }',
      ].join('\n'),
      replace: [
        '  insertText(sec: number, para: number, charOffset: number, text: string): string {',
        GUARD,
        '    const at = this.bodyTextOffset(sec, para, charOffset);',
        '    if (text.length > 0 && this.bodyLogicalOffset(sec, para, at) < charOffset) {',
        '      const inserted = JSON.parse(this.doc.insertTextLogical(sec, para, charOffset, text));',
        '      return JSON.stringify({ ok: inserted.ok !== false, charOffset: inserted.logicalOffset });',
        '    }',
        '    return this.withBodyLogicalOffset(sec, para, this.doc.insertText(sec, para, at, text));',
        '  }',
        ...HELPERS,
      ].join('\n'),
    },
    {
      find: [
        "    if (typeof doc.replaceBodyTextLocal === 'function') {",
        '      return parseLocalBodyTextReplaceResult(',
        '        doc.replaceBodyTextLocal(sec, para, charOffset, deleteCount, text),',
        '      );',
        '    }',
        '    if (deleteCount > 0) {',
        '      this.doc.deleteText(sec, para, charOffset, deleteCount);',
        '    }',
        '    if (text.length > 0) {',
        '      this.doc.insertText(sec, para, charOffset, text);',
        '    }',
      ].join('\n'),
      replace: [
        '    const [at, count] = this.bodyTextRange(sec, para, charOffset, deleteCount);',
        '    if (text.length > 0 && this.bodyLogicalOffset(sec, para, at) < charOffset) {',
        '      if (count > 0) this.doc.deleteText(sec, para, at, count);',
        '      const inserted = JSON.parse(this.doc.insertTextLogical(sec, para, charOffset, text));',
        '      return {',
        '        ok: inserted.ok !== false,',
        '        charOffset: inserted.logicalOffset,',
        '        documentPaginationPending: false,',
        '        flowChanged: true,',
        '      };',
        '    }',
        "    if (typeof doc.replaceBodyTextLocal === 'function') {",
        '      const replaced = parseLocalBodyTextReplaceResult(',
        '        doc.replaceBodyTextLocal(sec, para, at, count, text),',
        '      );',
        "      if (typeof replaced.charOffset === 'number') {",
        '        replaced.charOffset = this.bodyLogicalOffset(sec, para, replaced.charOffset);',
        '      }',
        '      return replaced;',
        '    }',
        '    if (count > 0) {',
        '      this.doc.deleteText(sec, para, at, count);',
        '    }',
        '    if (text.length > 0) {',
        '      this.doc.insertText(sec, para, at, text);',
        '    }',
      ].join('\n'),
    },
    {
      find: [
        '  deleteText(sec: number, para: number, charOffset: number, count: number): string {',
        GUARD,
        '    return this.doc.deleteText(sec, para, charOffset, count);',
      ].join('\n'),
      replace: [
        '  deleteText(sec: number, para: number, charOffset: number, count: number): string {',
        GUARD,
        '    const [at, n] = this.bodyTextRange(sec, para, charOffset, count);',
        '    if (n === 0 && count > 0) return JSON.stringify({ ok: true, charOffset });',
        '    return this.withBodyLogicalOffset(sec, para, this.doc.deleteText(sec, para, at, n));',
      ].join('\n'),
    },
    afterGuard(
      '  splitParagraph(sec: number, para: number, charOffset: number, removedParaMeta?: RemovedParaMeta): string {',
      ['    charOffset = this.bodyTextOffset(sec, para, charOffset);'],
    ),
    afterGuard(
      '  getTextRange(sec: number, para: number, charOffset: number, count: number): string {',
      ['    [charOffset, count] = this.bodyTextRange(sec, para, charOffset, count);'],
    ),
    {
      find: [
        '  getParagraphLength(sec: number, para: number): number {',
        GUARD,
        '    return this.doc.getParagraphLength(sec, para);',
      ].join('\n'),
      replace: [
        '  getParagraphLength(sec: number, para: number): number {',
        GUARD,
        '    try {',
        '      return this.doc.getLogicalLength(sec, para);',
        '    } catch {',
        '      return this.doc.getParagraphLength(sec, para);',
        '    }',
      ].join('\n'),
    },
    {
      find: [
        '  deleteRange(sec: number, startPara: number, startOffset: number, endPara: number, endOffset: number): { ok: boolean; paraIdx: number; charOffset: number } {',
        GUARD,
        '    return JSON.parse(this.doc.deleteRange(sec, startPara, startOffset, endPara, endOffset));',
      ].join('\n'),
      replace: [
        '  deleteRange(sec: number, startPara: number, startOffset: number, endPara: number, endOffset: number): { ok: boolean; paraIdx: number; charOffset: number } {',
        GUARD,
        '    const result = JSON.parse(this.doc.deleteRange(',
        '      sec, startPara, this.bodyTextOffset(sec, startPara, startOffset),',
        '      endPara, this.bodyTextOffset(sec, endPara, endOffset),',
        '    ));',
        "    if (result && typeof result.charOffset === 'number') {",
        '      result.charOffset = this.bodyLogicalOffset(sec, result.paraIdx ?? startPara, result.charOffset);',
        '    }',
        '    return result;',
      ].join('\n'),
    },
    {
      find: [
        '  copySelection(sec: number, startPara: number, startOffset: number, endPara: number, endOffset: number): string {',
        GUARD,
        '    return this.doc.copySelection(sec, startPara, startOffset, endPara, endOffset);',
      ].join('\n'),
      replace: [
        '  copySelection(sec: number, startPara: number, startOffset: number, endPara: number, endOffset: number): string {',
        GUARD,
        '    return this.doc.copySelection(',
        '      sec, startPara, this.bodyTextOffset(sec, startPara, startOffset),',
        '      endPara, this.bodyTextOffset(sec, endPara, endOffset),',
        '    );',
      ].join('\n'),
    },
    // cells
    afterGuard(
      '  splitParagraphInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number, removedParaMeta?: RemovedParaMeta): string {',
      [`    charOffset = this.cellTextOffset(sec, parentPara, ${IDS}, charOffset);`],
    ),
    afterGuard(
      '  insertTextInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number, text: string): string {',
      [`    charOffset = this.cellTextOffset(sec, parentPara, ${IDS}, charOffset);`],
    ),
    afterGuard(
      '  insertTextInCellDeferredPagination(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number, text: string): DeferredCellTextMutationResult {',
      [`    charOffset = this.cellTextOffset(sec, parentPara, ${IDS}, charOffset);`],
    ),
    {
      find: [
        '    charOffset: number,',
        '    deleteCount: number,',
        '    text: string,',
        '  ): DeferredCellTextMutationResult {',
        GUARD,
      ].join('\n'),
      replace: [
        '    charOffset: number,',
        '    deleteCount: number,',
        '    text: string,',
        '  ): DeferredCellTextMutationResult {',
        GUARD,
        `    [charOffset, deleteCount] = this.cellTextRange(sec, parentPara, ${IDS}, charOffset, deleteCount);`,
      ].join('\n'),
    },
    afterGuard(
      '  deleteTextInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number, count: number): string {',
      [`    [charOffset, count] = this.cellTextRange(sec, parentPara, ${IDS}, charOffset, count);`],
    ),
    afterGuard(
      '  deleteTextInCellDeferredPagination(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number, count: number): DeferredCellTextMutationResult {',
      [`    [charOffset, count] = this.cellTextRange(sec, parentPara, ${IDS}, charOffset, count);`],
    ),
    afterGuard(
      '  insertTextInCellByPath(sec: number, parentPara: number, pathJson: string, charOffset: number, text: string): string {',
      ['    charOffset = this.cellTextOffset(sec, parentPara, pathJson, charOffset);'],
    ),
    afterGuard(
      '  deleteTextInCellByPath(sec: number, parentPara: number, pathJson: string, charOffset: number, count: number): string {',
      [
        '    [charOffset, count] = this.cellTextRange(sec, parentPara, pathJson, charOffset, count);',
      ],
    ),
    afterGuard(
      '  deleteRangeInCellByPath(sec: number, parentPara: number, pathJson: string, startPara: number, startOffset: number, endPara: number, endOffset: number): string {',
      [
        '    startOffset = this.cellTextOffset(sec, parentPara, this.cellParaPath(pathJson, startPara), startOffset);',
        '    endOffset = this.cellTextOffset(sec, parentPara, this.cellParaPath(pathJson, endPara), endOffset);',
      ],
    ),
    afterGuard(
      '  splitParagraphInCellByPath(sec: number, parentPara: number, pathJson: string, charOffset: number, removedParaMeta?: RemovedParaMeta): string {',
      ['    charOffset = this.cellTextOffset(sec, parentPara, pathJson, charOffset);'],
    ),
    afterGuard(
      '  getTextInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number, count: number): string {',
      [`    [charOffset, count] = this.cellTextRange(sec, parentPara, ${IDS}, charOffset, count);`],
    ),
    afterGuard(
      '  getTextInCellByPath(sec: number, parentPara: number, pathJson: string, charOffset: number, count: number): string {',
      [
        '    [charOffset, count] = this.cellTextRange(sec, parentPara, pathJson, charOffset, count);',
      ],
    ),
    afterGuard(
      '  getCellParagraphLength(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number): number {',
      [
        `    const logicalLength = this.cellLogicalLength(sec, parentPara, ${IDS});`,
        '    if (logicalLength !== null) return logicalLength;',
      ],
    ),
    afterGuard(
      '  getCellParagraphLengthByPath(sec: number, parentPara: number, pathJson: string): number {',
      [
        '    const logicalLength = this.cellLogicalLength(sec, parentPara, pathJson);',
        '    if (logicalLength !== null) return logicalLength;',
      ],
    ),
    afterGuard(
      '  deleteRangeInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, startCellPara: number, startOffset: number, endCellPara: number, endOffset: number): { ok: boolean; paraIdx: number; charOffset: number } {',
      [
        '    startOffset = this.cellTextOffset(sec, parentPara, this.cellIdsPath(controlIdx, cellIdx, startCellPara), startOffset);',
        '    endOffset = this.cellTextOffset(sec, parentPara, this.cellIdsPath(controlIdx, cellIdx, endCellPara), endOffset);',
      ],
    ),
  ],
}
