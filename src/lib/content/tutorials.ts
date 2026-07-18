/**
 * Interface-tutorial flags — the `interfaceTutorials` object in
 * astro.config.mjs, injected via a Vite define (same pattern as runtimes /
 * partial_grades). Each flag opts one chapter of the built-in "Platform
 * walkthrough" course into the site; the course ships only when at least one
 * flag is true. The filtering happens once, in lib/content/bundle.ts's
 * loadCourseTrees(), so pages, precache, and the courses list all agree.
 */
const raw = import.meta.env.PUBLIC_INTERFACE_TUTORIALS as unknown;

interface InterfaceTutorials {
  web?: boolean;
  database?: boolean;
  quizes?: boolean;
}

export const INTERFACE_TUTORIALS: InterfaceTutorials =
  raw !== null && typeof raw === 'object'
    ? (raw as InterfaceTutorials)
    : typeof raw === 'string' && raw !== ''
      ? (JSON.parse(raw) as InterfaceTutorials) // e.g. set through a real env var
      : {};

/** The walkthrough course's content id (src/content/courses/<id>/). */
export const WALKTHROUGH_COURSE_ID = '0.platform-walkthrough';

/** Chapter leaf name → the config flag that includes it. */
const CHAPTER_FLAGS: Record<string, keyof InterfaceTutorials> = {
  quizzes: 'quizes',
  database: 'database',
  web: 'web',
};

export function walkthroughChapterEnabled(chapterLeaf: string): boolean {
  const flag = CHAPTER_FLAGS[chapterLeaf];
  return flag !== undefined && INTERFACE_TUTORIALS[flag] === true;
}
