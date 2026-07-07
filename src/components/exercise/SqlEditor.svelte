<script lang="ts">
  // CodeMirror 6 SQL editor. Validity errors come from prepare()-ing against
  // SQLite WASM (the engine is the source of truth), not an editor linter —
  // so this component is just the buffer.
  //
  // Colors are pulled from the --editor-* / --syntax-* tokens in theme.css,
  // so the editor follows the gruvbox theme (and light/dark) automatically.
  import { onDestroy, onMount } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { keymap } from '@codemirror/view';
  import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
  import { tags } from '@lezer/highlight';
  import { sql, SQLite } from '@codemirror/lang-sql';

  let {
    initialDoc = '',
    onDocChange,
    onRun,
  }: {
    initialDoc?: string;
    onDocChange?: (doc: string) => void;
    /** Invoked on Mod-Enter so the keyboard can drive the Run action. */
    onRun?: () => void;
  } = $props();

  let host: HTMLDivElement;
  let view: EditorView | null = null;

  const gruvboxChrome = EditorView.theme({
    '&': {
      backgroundColor: 'var(--editor-bg)',
      color: 'var(--text-color)',
      fontSize: 'var(--font-size-sm)',
    },
    '.cm-content': { caretColor: 'var(--editor-cursor)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--editor-cursor)' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      { backgroundColor: 'var(--editor-selection)' },
    '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
    '.cm-gutters': {
      backgroundColor: 'var(--editor-gutter-bg)',
      color: 'var(--editor-gutter-fg)',
      borderRight: '1px solid var(--border-color)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--editor-active-line)',
      color: 'var(--text-color)',
    },
  });

  const gruvboxHighlight = HighlightStyle.define([
    { tag: tags.keyword, color: 'var(--syntax-keyword)' },
    { tag: [tags.string, tags.special(tags.string)], color: 'var(--syntax-string)' },
    { tag: [tags.number, tags.bool, tags.null], color: 'var(--syntax-number)' },
    { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
    { tag: tags.typeName, color: 'var(--syntax-type)' },
    { tag: tags.operator, color: 'var(--syntax-operator)' },
    { tag: [tags.name, tags.variableName], color: 'var(--syntax-name)' },
    { tag: tags.punctuation, color: 'var(--syntax-punctuation)' },
  ]);

  export function getText(): string {
    return view?.state.doc.toString() ?? '';
  }

  export function setText(text: string): void {
    view?.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  }

  onMount(() => {
    view = new EditorView({
      doc: initialDoc,
      extensions: [
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              onRun?.();
              return true;
            },
          },
        ]),
        basicSetup,
        gruvboxChrome,
        syntaxHighlighting(gruvboxHighlight),
        sql({ dialect: SQLite }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onDocChange?.(update.state.doc.toString());
        }),
      ],
      parent: host,
    });
  });

  onDestroy(() => view?.destroy());
</script>

<div class="editor" bind:this={host}></div>

<style>
  .editor {
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .editor :global(.cm-editor) {
    min-height: 12rem;
  }

  .editor :global(.cm-editor.cm-focused) {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
  }
</style>
