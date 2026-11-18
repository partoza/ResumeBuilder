import { useEffect, useLayoutEffect, useRef } from 'react';
import { ensureCssFont } from '../fonts.js';
import { richFonts, sanitizeEditor, toEditorHtml } from '../rich.js';

/**
 * A small rich-text box for the cover letter's paragraphs. It shows the formatting
 * (bold / italic / size / font) applied from the preview toolbar, keeps it while you
 * edit, and supports Ctrl+B / Ctrl+I. Paste is always plain text. Enter starts a new
 * paragraph; Shift+Enter a line break.
 */
export default function RichText({ id, value, onChange, placeholder, label }) {
  const ref = useRef(null);
  const emitted = useRef(null);

  // Load external value into the DOM only when it differs from what we last emitted,
  // so typing never resets the cursor.
  useLayoutEffect(() => {
    const html = toEditorHtml(value);
    if (html !== emitted.current) {
      ref.current.innerHTML = html;
      emitted.current = html;
    }
  }, [value]);

  useEffect(() => {
    for (const f of richFonts([value])) ensureCssFont(f);
  }, [value]);

  const emit = () => {
    const html = sanitizeEditor(ref.current);
    emitted.current = html;
    onChange(html);
  };

  const onKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && !e.altKey && ['b', 'i'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      document.execCommand('styleWithCSS', false, false);
      document.execCommand(e.key.toLowerCase() === 'b' ? 'bold' : 'italic');
      emit();
    }
  };

  const onPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div
      ref={ref}
      id={id}
      className="rich-editor"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      data-placeholder={placeholder}
      spellCheck
      onInput={emit}
      onBlur={emit}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onFocus={() => document.execCommand('defaultParagraphSeparator', false, 'p')}
    />
  );
}
