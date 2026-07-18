/**
 * Editor colour scheme, chosen independently of the app theme so the code
 * editor — and especially its autocomplete popup — can be pinned readable.
 *
 * Persisted in localStorage. The value maps to a `color-scheme` set on the
 * editor host element; because the editor's colours come from `light-dark()`
 * tokens in theme.css, overriding `color-scheme` on that subtree flips the
 * whole editor (popup included) without a second palette. 'match' clears the
 * override so the editor follows the app/OS theme.
 */
export const EDITOR_THEME_KEY = 'learn-anywhere-editor-theme';
export const EDITOR_THEME_EVENT = 'learn-anywhere-editor-theme';

export type EditorScheme = 'match' | 'light' | 'dark';

export function getEditorScheme(): EditorScheme {
  if (typeof localStorage === 'undefined') return 'match';
  const v = localStorage.getItem(EDITOR_THEME_KEY);
  return v === 'light' || v === 'dark' ? v : 'match';
}

export function setEditorScheme(scheme: EditorScheme): void {
  if (scheme === 'match') localStorage.removeItem(EDITOR_THEME_KEY);
  else localStorage.setItem(EDITOR_THEME_KEY, scheme);
  // A same-tab open editor won't get a `storage` event, so announce the change
  // ourselves for live updates.
  window.dispatchEvent(new CustomEvent(EDITOR_THEME_EVENT, { detail: scheme }));
}

/** `color-scheme` value for the editor host; '' means inherit the app theme. */
export function editorColorScheme(scheme: EditorScheme): string {
  return scheme === 'match' ? '' : scheme;
}
