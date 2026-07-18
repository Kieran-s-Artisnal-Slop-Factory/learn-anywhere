# Adding images to content

Two ways to put images in lessons (and chapter/course pages, glossary
entries, flashcard-deck descriptions — anything with a markdown body). Use
the first unless you have a reason not to.

## Recommended: co-locate the file and reference it relatively

Put the image file next to the markdown that uses it and reference it with
a **relative path**:

```
src/content/courses/
  my-course/
    my-chapter/
      diagram.png          ← the image, beside its lesson
      some-lesson.md
```

```markdown
![A diagram of the sync flow](./diagram.png)
```

At build time Astro processes the image: it's **optimized** (converted to
WebP), given explicit `width`/`height` (no layout shift) and lazy-loading,
and emitted as a hashed asset under `/_astro/`. That hashed path is:

- **base-aware** — works unchanged if the site is deployed under a
  sub-path (`BASE=/my-course/`);
- **offline-capable** — the service worker's asset crawl picks up
  `/_astro/` files, so images work offline like everything else;
- **cache-friendly** — the content hash in the filename means updated
  images bust caches automatically.

Supported formats: PNG, JPG, WebP, GIF, AVIF, SVG. A live example ships in
the Learn Anywhere 101 course
(`src/content/courses/1.learn-anywhere-101/creating-content/` — see the
Markdown Basics lesson).

Notes:

- The image file sits inside a chapter folder but is **not** a lesson —
  only `.md` files are content, so it won't trip the orphan check.
- Relative paths are per-file: `./diagram.png` from a lesson in the same
  folder, `../shared.png` for a file one level up (e.g. shared across a
  course's chapters).
- Styling: rendered images are constrained by the site's `.prose img`
  rules; add alt text — it's the accessible name and shows while loading.

## Alternative: `public/` for verbatim files

Files in `public/` are copied to the site root untouched — no optimization,
no hashing. Reference them with a root-absolute path:

```markdown
![Logo](/images/logo.png)      <!-- the file lives at public/images/logo.png -->
```

**Sub-path caveat:** markdown image paths are *not* rewritten for the
`BASE` setting. `/images/logo.png` breaks when the site is served under
`https://example.com/my-course/` — the browser requests
`example.com/images/logo.png`. Only use `public/` images if your site
deploys at a domain root, or the file must keep its exact name/bytes
(downloadable PDFs, favicons, files referenced by external tools).

When in doubt: co-locate and use a relative path.

## Images elsewhere

- **Question prompts / flashcard fronts & backs**: markdown image syntax
  works there too, but *relative paths don't* — prompts are rendered
  outside the file's location context. Keep images in the lesson body,
  which appears beside the quiz.
- **External URLs** (`https://…`): render fine online but won't be
  precached, so they're blank offline. Prefer local files.
