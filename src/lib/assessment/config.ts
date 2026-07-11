/**
 * Site-level grading settings — `partial_grades` in astro.config.mjs,
 * injected via a Vite define (same pattern as the contact endpoint).
 */
const raw = import.meta.env.PUBLIC_PARTIAL_GRADES as unknown;

/** Multi-select questions award partial marks when true. */
export const PARTIAL_GRADES: boolean = raw === true || raw === 'true';
