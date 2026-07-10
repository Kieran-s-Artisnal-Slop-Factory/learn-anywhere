/**
 * App colour palette (independent of the light/dark preference). The choice is
 * persisted in localStorage and applied as `data-palette` on <html>; theme.css
 * swaps its raw --pal-* slots per palette. 'boring' is the app default —
 * Layout.astro ships `data-palette="boring"` in the static HTML and its boot
 * script only rewrites the attribute when a different stored choice exists
 * (theme.css keeps gruvbox as the attribute-less base palette).
 */
export const PALETTE_KEY = 'learn-anywhere-palette';

export type Palette = 'gruvbox' | 'boring' | 'forrest';

export const DEFAULT_PALETTE: Palette = 'boring';

export const PALETTES: { value: Palette; label: string }[] = [
  { value: 'boring', label: 'Boring' },
  { value: 'gruvbox', label: 'Gruvbox' },
  { value: 'forrest', label: 'Forrest' },
];

export function getPalette(): Palette {
  if (typeof localStorage === 'undefined') return DEFAULT_PALETTE;
  const v = localStorage.getItem(PALETTE_KEY);
  return v === 'gruvbox' || v === 'boring' || v === 'forrest' ? v : DEFAULT_PALETTE;
}

export function setPalette(palette: Palette): void {
  if (palette === DEFAULT_PALETTE) localStorage.removeItem(PALETTE_KEY);
  else localStorage.setItem(PALETTE_KEY, palette);
  // Gruvbox is theme.css's attribute-less base; everything else is opted
  // into via the attribute.
  if (palette === 'gruvbox') delete document.documentElement.dataset.palette;
  else document.documentElement.dataset.palette = palette;
}
