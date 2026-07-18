<script lang="ts">
  /**
   * SQL flavour of the shared CodeEditor chassis — just wires in the
   * SQLite dialect (with its keyword autocomplete). Validity errors come
   * from the engine, not an editor linter.
   */
  import { sql, SQLite } from '@codemirror/lang-sql';
  import CodeEditor from '../editor/CodeEditor.svelte';

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

  let editor: CodeEditor | undefined = $state();

  export function getText(): string {
    return editor?.getText() ?? '';
  }

  export function setText(text: string): void {
    editor?.setText(text);
  }
</script>

<CodeEditor
  bind:this={editor}
  {initialDoc}
  extensions={[sql({ dialect: SQLite })]}
  {onDocChange}
  {onRun}
/>
