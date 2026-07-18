/**
 * Build-time manifest of every page the service worker should precache,
 * as base-relative paths (the SW resolves them against its scope). Course,
 * chapter, lesson, test, and glossary routes are generated from the content
 * collections, so new content is automatically offline-capable — no
 * hardcoded route list to keep in sync.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { loadCourseTrees } from '../lib/content/bundle';

export const GET: APIRoute = async () => {
  const paths = [
    '',
    'courses/',
    'flashcards/',
    'glossary/',
    'settings/',
    'onboarding/',
    'contact/',
    'playground/',
    'favicon.svg',
    'manifest.webmanifest',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/maskable-192.png',
    'icons/maskable-512.png',
  ];
  for (const tree of await loadCourseTrees()) {
    paths.push(`courses/${tree.course.id}/`);
    for (const { chapter, lessons } of tree.chapters) {
      // Ids are path-scoped, so they double as the route path.
      paths.push(`courses/${chapter.id}/`);
      if (
        chapter.data.test !== undefined ||
        chapter.data.test_database !== undefined ||
        chapter.data.test_web !== undefined
      ) {
        paths.push(`courses/${chapter.id}/test/`);
      }
      for (const lesson of lessons) {
        paths.push(`courses/${lesson.id}/`);
      }
    }
  }
  for (const entry of await getCollection('glossary')) {
    paths.push(`glossary/${entry.id}/`);
  }
  for (const deck of await getCollection('flashcards')) {
    paths.push(`flashcards/${deck.id}/`);
  }
  return new Response(JSON.stringify(paths), {
    headers: { 'Content-Type': 'application/json' },
  });
};
