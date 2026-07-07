<script lang="ts">
  // CodeMirror 6 SQL editor. Validity errors come from prepare()-ing against
  // SQLite WASM (the engine is the source of truth), not an editor linter —
  // so this component is just the buffer.
  import { onDestroy, onMount } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { sql, SQLite } from '@codemirror/lang-sql';

  let {
    initialDoc = '',
    onDocChange,
  }: {
    initialDoc?: string;
    onDocChange?: (doc: string) => void;
  } = $props();

  let host: HTMLDivElement;
  let view: EditorView | null = null;

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
        basicSetup,
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
    border-radius: var(--radius-2, 0.5rem);
    overflow: hidden;
  }

  .editor :global(.cm-editor) {
    min-height: 10rem;
    font-size: var(--font-size-sm);
  }

  .editor :global(.cm-editor.cm-focused) {
    outline: 2px solid var(--color-primary);
  }
</style>
