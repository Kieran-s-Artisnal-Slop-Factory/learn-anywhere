<script lang="ts">
  /**
   * The shared CodeMirror 6 editor chassis (ported from lite-learner's
   * SqlEditor, language generalized to a prop). This component is just the
   * buffer — validity errors come from the engines, not an editor linter.
   *
   * Colors are pulled from the --editor-* / --syntax-* tokens in theme.css,
   * so the editor follows the active palette (and light/dark) automatically;
   * lib/editorTheme.ts can pin the editor's scheme independently of the app.
   *
   * Per-kind wrappers (SqlEditor for database, the web-tab editors later)
   * pass their language + extras via `extensions`.
   */
  import { onDestroy, onMount } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { keymap } from '@codemirror/view';
  import type { Extension } from '@codemirror/state';
  import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
  import { tags } from '@lezer/highlight';
  import {
    EDITOR_THEME_EVENT,
    editorColorScheme,
    getEditorScheme,
    EDITOR_THEME_KEY,
  } from '../../lib/editorTheme';

  let {
    initialDoc = '',
    extensions = [],
    onDocChange,
    onRun,
  }: {
    initialDoc?: string;
    /** Language support + any per-use extras (autocomplete config, Emmet, …). */
    extensions?: Extension[];
    onDocChange?: (doc: string) => void;
    /** Invoked on Mod-Enter so the keyboard can drive the Run action. */
    onRun?: () => void;
  } = $props();

  let host: HTMLDivElement;
  let view: EditorView | null = null;

  const tokenChrome = EditorView.theme({
    '&': {
      backgroundColor: 'var(--editor-bg)',
      color: 'var(--text-color)',
      fontSize: 'var(--font-size-sm)',
      borderRadius: 'var(--radius-md)',
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
    // Autocomplete ("intellisense") popup — driven from theme tokens so it
    // stays legible in light, dark, and pinned schemes.
    '.cm-tooltip': {
      backgroundColor: 'var(--editor-tooltip-bg)',
      color: 'var(--editor-tooltip-fg)',
      border: '1px solid var(--editor-tooltip-border)',
      borderRadius: 'var(--radius-sm)',
      boxShadow: 'var(--shadow-2)',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul': {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--font-size-sm)',
      maxHeight: '15em',
    },
    '.cm-tooltip-autocomplete > ul > li': {
      padding: '2px 6px',
      color: 'var(--editor-tooltip-fg)',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'var(--editor-tooltip-selected-bg)',
      color: 'var(--editor-tooltip-selected-fg)',
    },
    '.cm-completionIcon': {
      color: 'var(--text-muted-color)',
      opacity: '1',
      paddingRight: '0.6em',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionIcon': {
      color: 'var(--editor-tooltip-selected-fg)',
    },
    '.cm-completionMatchedText': {
      color: 'var(--editor-match-fg)',
      textDecoration: 'none',
      fontWeight: '700',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionMatchedText': {
      color: 'var(--editor-tooltip-selected-fg)',
      textDecoration: 'underline',
    },
    '.cm-completionDetail': {
      color: 'var(--text-muted-color)',
      fontStyle: 'italic',
    },
    '.cm-completionInfo': {
      backgroundColor: 'var(--editor-tooltip-bg)',
      color: 'var(--editor-tooltip-fg)',
      border: '1px solid var(--editor-tooltip-border)',
      borderRadius: 'var(--radius-sm)',
    },
  });

  const tokenHighlight = HighlightStyle.define([
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

  // Pin the editor (and its popup) to the user's chosen scheme by overriding
  // color-scheme on the host — the light-dark() tokens resolve per-subtree.
  function applyScheme() {
    if (host) host.style.colorScheme = editorColorScheme(getEditorScheme());
  }

  function onStorage(e: StorageEvent) {
    if (e.key === EDITOR_THEME_KEY) applyScheme();
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
        tokenChrome,
        syntaxHighlighting(tokenHighlight),
        ...extensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onDocChange?.(update.state.doc.toString());
        }),
      ],
      parent: host,
    });
    applyScheme();
    window.addEventListener(EDITOR_THEME_EVENT, applyScheme);
    window.addEventListener('storage', onStorage);
  });

  onDestroy(() => {
    view?.destroy();
    window.removeEventListener(EDITOR_THEME_EVENT, applyScheme);
    window.removeEventListener('storage', onStorage);
  });
</script>

<div class="editor" bind:this={host}></div>

<style>
  .editor {
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    /* No overflow:hidden — it would clip the autocomplete popup. The inner
       .cm-editor rounds its own corners to match the border instead. */
  }

  .editor :global(.cm-editor) {
    min-height: 12rem;
  }

  .editor :global(.cm-editor.cm-focused) {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
  }
</style>
