/**
 * studio-equation-slots
 *   Hancom's equation editor puts the caret into a box when ^ (Shift+6) or
 *   _ (Shift+-) is typed: what follows is the superscript or the subscript
 *   until Tab or → leaves the box. The studio's editor is a script box, where
 *   ^ and _ are plain characters and only the next word is raised or lowered,
 *   and Tab moves the focus out of the dialog.
 *
 *   In the script box, ^ and _ now come with an empty group, `^{}` / `_{}`,
 *   and the caret inside it; a selection goes into the group. Tab leaves the
 *   group the caret is in, or, outside any group, goes into the next empty one
 *   (the templates' `{} over {}` slots too); Shift+Tab goes into the empty
 *   group before the caret.
 *   The autocomplete list keeps Tab while it is open. The keys come through
 *   `beforeinput`, so a Korean input method that is composing does not lose
 *   them.
 */
const DIALOG = /[\\/]rhwp-studio[\\/]src[\\/]ui[\\/]equation-editor-dialog\.ts$/

const METHODS = [
  '',
  '  /** ^ or _ typed in the script box: an empty group after it, with the caret (or the selection) inside. */',
  '  private onScriptBeforeInput(e: InputEvent): void {',
  "    if (e.inputType !== 'insertText' || (e.data !== '^' && e.data !== '_')) return;",
  '    const ta = this.scriptArea;',
  '    const start = ta.selectionStart;',
  '    const end = ta.selectionEnd;',
  '    const selected = ta.value.substring(start, end);',
  "    if (selected === '' && ta.value.charAt(end) === '{') return;",
  '    const insertion = `${e.data}{${selected}}`;',
  '    if (ta.value.length - selected.length + insertion.length > MAX_EQUATION_SCRIPT_LEN) return;',
  '    e.preventDefault();',
  "    ta.setRangeText(insertion, start, end, 'end');",
  '    const caret = start + 2 + selected.length;',
  '    ta.selectionStart = caret;',
  '    ta.selectionEnd = caret;',
  '    this.schedulePreview();',
  '    this.onScriptInput();',
  '  }',
  '',
  '  /** Tab: out of the group the caret is in, else into the next empty group. Shift+Tab: the empty group before. */',
  '  private moveScriptSlot(backward: boolean): boolean {',
  '    const ta = this.scriptArea;',
  '    const text = ta.value;',
  '    const at = backward ? ta.selectionStart : ta.selectionEnd;',
  '    let target = -1;',
  '    if (backward) {',
  "      const slot = text.lastIndexOf('{}', at - 2);",
  '      if (slot >= 0) target = slot + 1;',
  '    } else {',
  '      // out of the group the caret is in, else into the next empty group',
  '      let depth = 0;',
  '      for (let i = at; i < text.length; i++) {',
  "        if (text[i] === '{') depth++;",
  "        else if (text[i] === '}') {",
  '          if (depth === 0) { target = i + 1; break; }',
  '          depth--;',
  '        }',
  '      }',
  '      if (target < 0) {',
  "        const slot = text.indexOf('{}', at);",
  '        if (slot >= 0) target = slot + 1;',
  '      }',
  '    }',
  '    if (target < 0) return false;',
  '    ta.selectionStart = target;',
  '    ta.selectionEnd = target;',
  '    return true;',
  '  }',
]

export const EQUATION_SLOTS_PATCH = {
  file: DIALOG,
  edits: [
    {
      find: "    this.scriptArea.addEventListener('keydown', (e) => this.onScriptKeydown(e));",
      replace: [
        "    this.scriptArea.addEventListener('keydown', (e) => this.onScriptKeydown(e));",
        "    this.scriptArea.addEventListener('beforeinput', (e) => this.onScriptBeforeInput(e as InputEvent));",
      ].join('\n'),
    },
    {
      find: [
        '  private onScriptKeydown(e: KeyboardEvent): void {',
        '    if (!this.acVisible) return;',
      ].join('\n'),
      replace: [
        '  private onScriptKeydown(e: KeyboardEvent): void {',
        '    if (!this.acVisible) {',
        "      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.isComposing) {",
        '        if (this.moveScriptSlot(e.shiftKey)) e.preventDefault();',
        '      }',
        '      return;',
        '    }',
      ].join('\n'),
    },
    {
      find: '  // ── 기호 검색 ─────────────────────────────────',
      replace: [...METHODS, '', '  // ── 기호 검색 ─────────────────────────────────'].join('\n'),
    },
  ],
}
