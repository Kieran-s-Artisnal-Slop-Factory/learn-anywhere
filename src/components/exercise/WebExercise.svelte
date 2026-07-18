<script lang="ts">
  /**
   * The web-preview exercise workspace: HTML / CSS / JS-or-TS editor tabs
   * with a live, sandboxed preview. There is NO evaluation — the learner
   * builds a page and presses "Submit work" to complete; the parent owns
   * persistence via callbacks (lesson row vs chapter-test row vs the
   * playground store), same pattern as DatabaseExercise.
   *
   * Details:
   *  - All three editors stay mounted (hidden by tab) so buffers and undo
   *    history survive tab switches.
   *  - The LIVE preview is an `srcdoc` iframe with `sandbox="allow-scripts"`
   *    — a unique origin, so learner code can't touch the app or its
   *    storage. Rebuilt on a debounce; user HTML is treated as body content.
   *    A tiny injected shim forwards console output / errors to the strip
   *    below the preview via postMessage.
   *  - `lang: ts` runs the script through Sucrase (type stripping only —
   *    no typechecking; lazy-imported so JS lessons never pay for it).
   *  - Emmet abbreviations on the HTML and CSS tabs (Tab / Ctrl-E).
   *  - Exports (also lazy): a zip of standalone files (fflate) and a PNG
   *    screenshot (modern-screenshot) — the screenshot renders the buffers
   *    into a temporary, hidden, NON-sandboxed iframe (same origin, so the
   *    DOM is capturable), then removes it. Acceptable because it's the
   *    learner's own code, run only on their explicit click.
   *  - `endpoint`/`meta`: result_endpoint support — Submit work POSTs the
   *    three buffers (`passed: n/a`), profile-gated like other kinds.
   */
  import { onDestroy, onMount } from 'svelte';
  import { keymap } from '@codemirror/view';
  import { html } from '@codemirror/lang-html';
  import { css } from '@codemirror/lang-css';
  import { javascript } from '@codemirror/lang-javascript';
  import { abbreviationTracker, expandAbbreviation } from '@emmetio/codemirror6-plugin';
  import type { WebBlock } from '../../lib/content/types';
  import { postSolutionResult, type SubmissionMeta } from '../../lib/assessment/submit';
  import { getProfile, profileComplete, type Profile } from '../../lib/profile';
  import { href } from '../../lib/paths';
  import Card from '../Card.svelte';
  import CodeEditor from '../editor/CodeEditor.svelte';

  let {
    block,
    initialSolution = null,
    completed = false,
    onSave,
    onSubmit = null,
    endpoint = null,
    meta = null,
    wide = false,
    exportName = 'my-page',
  }: {
    block: WebBlock;
    /** Saved buffers from the row (html/css/js keys). */
    initialSolution?: Record<string, string> | null;
    completed?: boolean;
    /** Persist the buffers (debounced by this component). */
    onSave: (buffers: Record<string, string>) => Promise<void>;
    /** "Submit work" — completes the lesson/test. Null hides the button (playground). */
    onSubmit?: (() => Promise<void>) | null;
    /** result_endpoint from the content — POSTs buffers on submit. */
    endpoint?: string | null;
    meta?: SubmissionMeta | null;
    /** Side-by-side editor/preview (full-width pages: tests, playground). */
    wide?: boolean;
    /** Base filename for the zip / screenshot downloads. */
    exportName?: string;
  } = $props();

  const isTs = block.lang === 'ts';
  const scriptLabel = isTs ? 'TS' : 'JS';
  const tabs = ['HTML', 'CSS', scriptLabel] as const;

  // Starting buffers: saved work wins, then the authored starter.
  const start = {
    html: initialSolution?.html ?? block.starter.html,
    css: initialSolution?.css ?? block.starter.css,
    js: initialSolution?.js ?? block.starter.js,
  };
  const buffers: Record<'html' | 'css' | 'js', string> = { ...start };

  let active = $state<(typeof tabs)[number]>('HTML');
  let htmlEditor: CodeEditor | undefined = $state();
  let cssEditor: CodeEditor | undefined = $state();
  let jsEditor: CodeEditor | undefined = $state();
  let frame: HTMLIFrameElement | undefined = $state();

  let tsError = $state<string | null>(null);
  let restoredBanner = $state(initialSolution !== null);
  let exportMsg = $state<string | null>(null);
  let exportError = $state<string | null>(null);

  // Viewport presets for the preview (width in px; null = fill).
  const VIEWPORTS = [
    { id: 'full', label: 'Full', width: null as number | null },
    { id: 'tablet', label: 'Tablet', width: 768 },
    { id: 'mobile', label: 'Mobile', width: 375 },
  ];
  let viewport = $state('full');
  const viewportWidth = $derived(VIEWPORTS.find((v) => v.id === viewport)?.width ?? null);

  // Console strip: messages forwarded from the preview shim.
  interface ConsoleMsg {
    level: string;
    text: string;
  }
  let consoleMsgs = $state<ConsoleMsg[]>([]);

  // result_endpoint state.
  let profile = $state<Profile>({ name: '', email: '' });
  let profileReady = $state(false);
  let sendState = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  let sendError = $state<string | null>(null);
  const locked = $derived(endpoint != null && profileReady && !profileComplete(profile));

  const emmetKeys = keymap.of([
    { key: 'Tab', run: expandAbbreviation },
    { key: 'Ctrl-e', run: expandAbbreviation },
  ]);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function onEdit(key: 'html' | 'css' | 'js', doc: string) {
    buffers[key] = doc;
    restoredBanner = false;
    exportMsg = null;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void onSave({ ...buffers });
      void refreshPreview();
    }, 500);
  }

  /** Guard against user code closing our wrapper tags early. */
  const escapeEnd = (code: string, tag: string) =>
    code.replaceAll(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);

  async function compiledScript(): Promise<string> {
    if (!isTs) return buffers.js;
    const { transform } = await import('sucrase');
    return transform(buffers.js, { transforms: ['typescript'] }).code;
  }

  /** Forwards console output + uncaught errors to the parent strip. */
  const CONSOLE_SHIM = `<script>(function(){
    var send = function (level, args) {
      try {
        parent.postMessage({ la: 'console', level: level, text: args.map(function (a) {
          try { return typeof a === 'string' ? a : JSON.stringify(a); } catch (e) { return String(a); }
        }).join(' ') }, '*');
      } catch (e) {}
    };
    ['log','info','warn','error'].forEach(function (level) {
      var original = console[level];
      console[level] = function () { send(level, [].slice.call(arguments)); original.apply(console, arguments); };
    });
    addEventListener('error', function (e) { send('error', [e.message]); });
    addEventListener('unhandledrejection', function (e) { send('error', ['Unhandled rejection: ' + e.reason]); });
  })();<\/script>`;

  /** The full preview document from the current buffers. */
  function buildDocument(script: string, withShim: boolean): string {
    return [
      '<!doctype html><html><head><meta charset="utf-8">',
      withShim ? CONSOLE_SHIM : '',
      `<style>${escapeEnd(buffers.css, 'style')}</style>`,
      '</head><body>',
      buffers.html,
      `<script type="module">${escapeEnd(script, 'script')}<\/script>`,
      '</body></html>',
    ].join('\n');
  }

  async function refreshPreview() {
    if (!frame) return;
    let script: string;
    try {
      script = await compiledScript();
      tsError = null;
    } catch (err) {
      // Keep the last good preview; surface the compile error instead.
      tsError = err instanceof Error ? err.message : String(err);
      return;
    }
    consoleMsgs = [];
    frame.srcdoc = buildDocument(script, true);
  }

  function onMessage(event: MessageEvent) {
    if (frame && event.source === frame.contentWindow && event.data?.la === 'console') {
      consoleMsgs = [...consoleMsgs, { level: event.data.level, text: String(event.data.text) }].slice(-50);
    }
  }

  function triggerDownload(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Zip of standalone files: index.html + styles.css + script.js (+ .ts). */
  async function exportZip() {
    exportMsg = null;
    exportError = null;
    try {
      const script = await compiledScript();
      const { zipSync, strToU8 } = await import('fflate');
      const indexHtml = [
        '<!doctype html>',
        '<html>',
        '<head>',
        '<meta charset="utf-8">',
        '<link rel="stylesheet" href="styles.css">',
        '</head>',
        '<body>',
        buffers.html,
        '<script type="module" src="script.js"><\/script>',
        '</body>',
        '</html>',
      ].join('\n');
      const files: Record<string, Uint8Array> = {
        'index.html': strToU8(indexHtml),
        'styles.css': strToU8(buffers.css),
        'script.js': strToU8(script),
      };
      if (isTs) files['script.ts'] = strToU8(buffers.js);
      const zipped = zipSync(files, { level: 6 });
      triggerDownload(`${exportName}.zip`, new Blob([zipped as BlobPart], { type: 'application/zip' }));
      exportMsg = `Downloaded ${exportName}.zip`;
    } catch (err) {
      exportError = err instanceof Error ? err.message : String(err);
    }
  }

  /**
   * PNG screenshot. The live preview's sandbox makes its DOM unreachable,
   * so render the buffers into a temporary same-origin iframe (learner's
   * own code, explicit click), capture it, and remove it.
   */
  async function exportScreenshot(mode: 'viewport' | 'page') {
    exportMsg = null;
    exportError = null;
    let temp: HTMLIFrameElement | null = null;
    try {
      const script = await compiledScript();
      const { domToPng } = await import('modern-screenshot');

      const width = viewportWidth ?? frame?.clientWidth ?? 1024;
      const viewHeight = frame?.clientHeight ?? 600;
      temp = document.createElement('iframe');
      temp.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${viewHeight}px;border:0;`;
      document.body.appendChild(temp);
      await new Promise<void>((resolve) => {
        temp!.addEventListener('load', () => resolve(), { once: true });
        temp!.srcdoc = buildDocument(script, false);
      });
      // Let scripts paint (fonts/layout settle).
      await new Promise((r) => setTimeout(r, 350));

      const doc = temp.contentDocument!;
      const height =
        mode === 'page' ? Math.max(doc.documentElement.scrollHeight, viewHeight) : viewHeight;
      if (mode === 'page') temp.style.height = `${height}px`;

      const dataUrl = await domToPng(doc.documentElement, {
        width,
        height,
        backgroundColor: '#ffffff',
      });
      const bytes = await (await fetch(dataUrl)).blob();
      triggerDownload(`${exportName}-${mode}.png`, bytes);
      exportMsg = `Downloaded ${exportName}-${mode}.png (${width}×${height})`;
    } catch (err) {
      exportError = err instanceof Error ? err.message : String(err);
    } finally {
      temp?.remove();
    }
  }

  function onExportPick(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const value = select.value;
    select.value = '';
    if (value === 'zip') void exportZip();
    else if (value === 'shot-viewport') void exportScreenshot('viewport');
    else if (value === 'shot-page') void exportScreenshot('page');
  }

  async function resetToStarter() {
    if (!confirm('Reset all three tabs to the starter code? Your work here will be replaced.')) {
      return;
    }
    buffers.html = block.starter.html;
    buffers.css = block.starter.css;
    buffers.js = block.starter.js;
    htmlEditor?.setText(buffers.html);
    cssEditor?.setText(buffers.css);
    jsEditor?.setText(buffers.js);
    tsError = null;
    restoredBanner = false;
    clearTimeout(debounceTimer);
    await onSave({ ...buffers });
    await refreshPreview();
  }

  async function submit() {
    if (!onSubmit || locked) return;
    clearTimeout(debounceTimer);
    await onSave({ ...buffers });
    await onSubmit();
    if (endpoint && meta) {
      sendState = 'sending';
      sendError = null;
      try {
        await postSolutionResult(
          endpoint,
          meta,
          { html: buffers.html, css: buffers.css, js: buffers.js },
          null,
          profile
        );
        sendState = 'sent';
      } catch (err) {
        sendState = 'failed';
        sendError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  function retrySend() {
    void (async () => {
      if (!endpoint || !meta) return;
      sendState = 'sending';
      sendError = null;
      try {
        await postSolutionResult(
          endpoint,
          meta,
          { html: buffers.html, css: buffers.css, js: buffers.js },
          null,
          profile
        );
        sendState = 'sent';
      } catch (err) {
        sendState = 'failed';
        sendError = err instanceof Error ? err.message : String(err);
      }
    })();
  }

  // First render once the iframe exists.
  $effect(() => {
    if (frame) void refreshPreview();
  });

  onMount(() => {
    profile = getProfile();
    profileReady = true;
    window.addEventListener('message', onMessage);
  });

  onDestroy(() => {
    clearTimeout(debounceTimer);
    window.removeEventListener('message', onMessage);
  });
</script>

<div class="stack">
  {#if restoredBanner}
    <p class="banner banner-success">Your saved work was restored.</p>
  {/if}

  {#if locked}
    <p class="banner banner-danger">
      This {meta?.kind === 'test' ? 'test' : 'exercise'} sends your work to the course team, so
      your name and email must be set before submitting — add them in
      <a href={href('/settings/')}>Settings</a>. You can keep building in the meantime.
    </p>
  {/if}

  {#if sendState === 'sending'}
    <p class="banner">Sending your work for review…</p>
  {:else if sendState === 'sent'}
    <p class="banner banner-success">Your work was sent to the course team for review.</p>
  {:else if sendState === 'failed'}
    <p class="banner banner-danger">
      Saved locally, but sending for review failed ({sendError}).
      <button type="button" class="btn btn-sm retry" onclick={retrySend}>Retry send</button>
    </p>
  {/if}

  {#if exportMsg}
    <p class="banner banner-success">{exportMsg}</p>
  {/if}
  {#if exportError}
    <p class="banner banner-danger">Export failed: {exportError}</p>
  {/if}

  <div class="workspace" class:wide>
    <Card title="Editor">
      {#snippet actions()}
        <span class="muted hint">Emmet: <kbd>Tab</kbd> expands abbreviations</span>
      {/snippet}
      <div class="tabs" role="tablist">
        {#each tabs as tab (tab)}
          <button
            class="tab"
            class:active={active === tab}
            role="tab"
            aria-selected={active === tab}
            onclick={() => (active = tab)}
          >
            {tab}
          </button>
        {/each}
      </div>

      <div class="pane" hidden={active !== 'HTML'}>
        <CodeEditor
          bind:this={htmlEditor}
          initialDoc={start.html}
          extensions={[emmetKeys, html(), abbreviationTracker()]}
          onDocChange={(doc) => onEdit('html', doc)}
        />
      </div>
      <div class="pane" hidden={active !== 'CSS'}>
        <CodeEditor
          bind:this={cssEditor}
          initialDoc={start.css}
          extensions={[emmetKeys, css(), abbreviationTracker({ syntax: 'css' })]}
          onDocChange={(doc) => onEdit('css', doc)}
        />
      </div>
      <div class="pane" hidden={active !== scriptLabel}>
        <CodeEditor
          bind:this={jsEditor}
          initialDoc={start.js}
          extensions={[javascript({ typescript: isTs })]}
          onDocChange={(doc) => onEdit('js', doc)}
        />
      </div>

      {#if tsError}
        <p class="banner banner-danger ts-error">TypeScript error: {tsError}</p>
      {/if}

      <div class="row toolbar">
        {#if onSubmit && !completed}
          <button class="btn btn-primary" onclick={submit} disabled={locked}>Submit work</button>
        {/if}
        <label class="picker">
          <span class="visually-hidden">Export</span>
          <select onchange={onExportPick} aria-label="Export">
            <option value="">Export…</option>
            <option value="zip">Zip of files (.zip)</option>
            <option value="shot-viewport">Screenshot — viewport (.png)</option>
            <option value="shot-page">Screenshot — full page (.png)</option>
          </select>
        </label>
        <button class="btn btn-danger reset" onclick={resetToStarter}>Reset to starter</button>
      </div>
    </Card>

    <Card title="Preview">
      {#snippet actions()}
        <div class="row preview-actions">
          <div class="seg" role="group" aria-label="Preview width">
            {#each VIEWPORTS as v (v.id)}
              <button
                type="button"
                class="seg-btn"
                class:on={viewport === v.id}
                aria-pressed={viewport === v.id}
                onclick={() => (viewport = v.id)}
              >
                {v.label}
              </button>
            {/each}
          </div>
          <button class="btn btn-sm" onclick={() => void refreshPreview()}>Refresh</button>
        </div>
      {/snippet}
      <div class="frame-wrap">
        <!-- Drag the corner handle to resize freely; clicking a viewport
             preset rewrites the style attribute, which resets the drag. -->
        <div class="resize-box" style={viewportWidth ? `width: ${viewportWidth}px;` : ''}>
          <iframe bind:this={frame} title="Page preview" sandbox="allow-scripts" class="preview"
          ></iframe>
        </div>
      </div>
      {#if consoleMsgs.length > 0}
        <div class="console">
          <div class="console-head">
            <span class="muted hint">Console</span>
            <button class="btn btn-sm" onclick={() => (consoleMsgs = [])}>Clear</button>
          </div>
          <ul>
            {#each consoleMsgs as msg, i (i)}
              <li class={`level-${msg.level}`}>
                <span class="level">{msg.level}</span>
                {msg.text}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </Card>
  </div>
</div>

<style>
  /* Side-by-side editor/preview on full-width pages (tests, playground). */
  .workspace {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }

  @media (min-width: 64rem) {
    .workspace.wide {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }

  .tabs {
    display: flex;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
    border-bottom: 1px solid var(--border-color);
  }

  .tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--space-1) var(--space-3);
    cursor: pointer;
    color: var(--text-muted-color);
    font: inherit;
    font-weight: 600;
    font-size: var(--font-size-sm);
  }

  .tab:hover {
    color: var(--text-color);
  }

  .tab.active {
    color: var(--color-primary-strong);
    border-bottom-color: var(--color-primary);
  }

  .pane[hidden] {
    display: none;
  }

  .ts-error {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    margin-top: var(--space-3);
  }

  .toolbar {
    margin-top: var(--space-3);
  }

  .toolbar .reset {
    margin-left: auto;
  }

  .picker select {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--surface-color);
    color: var(--text-color);
    font: inherit;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    width: auto;
  }

  .preview-actions {
    gap: var(--space-2);
  }

  .seg {
    display: inline-flex;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .seg-btn {
    border: none;
    background: var(--surface-color);
    color: var(--text-muted-color);
    padding: var(--space-1) var(--space-2);
    font: inherit;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .seg-btn + .seg-btn {
    border-left: 1px solid var(--border-color);
  }

  .seg-btn.on {
    background: var(--color-primary-soft);
    color: var(--color-primary-strong);
  }

  .frame-wrap {
    display: flex;
    justify-content: center;
    background: var(--surface-raised-color);
    border-radius: var(--radius-md);
    /* A dragged-out preview scrolls here instead of blowing up the card. */
    overflow: auto;
  }

  /* Directly resizable in both directions via the corner handle. Deliberately
     NOT capped at the container width — overflowing is sometimes the point;
     .frame-wrap scrolls it. */
  .resize-box {
    resize: both;
    overflow: hidden;
    flex-shrink: 0; /* let a drag exceed the container; .frame-wrap scrolls */
    width: 100%;
    height: 24rem;
    min-width: 10rem;
    min-height: 6rem;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: #fff;
  }

  .preview {
    display: block;
    width: 100%;
    height: 100%;
    border: none;
    background: #fff;
  }

  .console {
    margin-top: var(--space-3);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .console-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-1) var(--space-3);
    background: var(--surface-raised-color);
    border-bottom: 1px solid var(--border-color);
  }

  .console ul {
    list-style: none;
    margin: 0;
    padding: var(--space-2) var(--space-3);
    max-height: 10rem;
    overflow-y: auto;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .console .level {
    display: inline-block;
    min-width: 3.2em;
    font-weight: 700;
    color: var(--text-muted-color);
  }

  .console .level-warn .level {
    color: var(--color-warning);
  }

  .console .level-error {
    color: var(--color-danger);
  }

  .console .level-error .level {
    color: var(--color-danger);
  }

  .hint {
    font-size: var(--font-size-sm);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
