# Authoring database exercises

Database exercises run the learner's SQL against a **real SQLite database in
their browser**, and solutions are checked against the actual state of that
database — not against the SQL text they typed. This guide covers the
frontmatter, the checking rules, and the recipes that make hard-to-observe
tasks checkable.

Prerequisite: the `sqlite` runtime must be enabled — see
[runtimes.md](runtimes.md). A working reference course ships in
`src/content/courses/9.sql-demo/`.

## Contents

- [The `database:` block](#the-database-block)
- [Sandbox vs checked exercises](#sandbox-vs-checked-exercises)
- [Database chapter tests](#database-chapter-tests)
- [Writing `desired_state`](#writing-desired_state)
- [Recipes for tougher checks](#recipes-for-tougher-checks)
- [Sending SQL for marking](#sending-sql-for-marking-result_endpoint)
- [What the learner experiences](#what-the-learner-experiences)
- [The playground](#the-playground)
- [Testing your exercises](#testing-your-exercises)

## The `database:` block

A lesson becomes a database exercise by declaring a `database:` block (a
lesson has at most one assessment block — `quiz`, `database`, or `web`):

```markdown
---
title: Filter with WHERE
database:
  runtime: sqlite            # optional, 'sqlite' is the default
  initial_sql: |
    CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT, pages INTEGER);
    INSERT INTO books (title, pages) VALUES ('Whale Song', 320), ('Desert Lines', 144);
  desired_state:             # omit ⇒ explorable sandbox
    query: "SELECT title FROM long_books ORDER BY title;"
    rows:
      - { title: Whale Song }
---

The lesson body is the instructions, shown beside the workspace. End with a
clearly marked "## Your task".
```

- **`initial_sql`** seeds a fresh in-memory database every time the lesson
  loads (and on Reset). It doesn't need to be idempotent — it always runs
  against a blank database.
- **`desired_state`** is the embedded solution check (below). Omit it for a
  sandbox.

## Sandbox vs checked exercises

| `desired_state` | The learner gets                                            | Completes when            |
| ---------------- | ----------------------------------------------------------- | ------------------------- |
| present          | editor, Run, **Check solution**, DB viewer                  | a check passes            |
| omitted          | the same workspace, free exploration, **Mark as done**      | they press *Mark as done* |

Use sandboxes for "poke at this database" lessons; the seeded data is the
lesson. (A lesson with no `database:` block at all is a plain reading page.)

## Database chapter tests

A chapter's `index.md` can declare `test_database:` instead of a question
`test:` — the whole test page becomes a SQL workspace. Because the test page
has no markdown body of its own (the chapter's body belongs to the chapter
page), give it the task text via `instructions` (markdown, glossary
references included):

```yaml
---
title: First Queries
lessons: [exploring-a-database, filter-with-where]
test_database:
  initial_sql: |
    CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT, pages INTEGER);
  desired_state:
    query: "SELECT name FROM pragma_table_info('reviews') ORDER BY cid;"
    rows:
      - { name: id }
      - { name: book_id }
      - { name: rating }
  instructions: |
    Create a `reviews` table with **exactly three columns, in this
    order**: `id` (INTEGER, primary key), `book_id`, `rating`.
---
```

Like question tests, the chapter only completes once every lesson is done
*and* the test has been passed; the last lesson's "next" button and the
chapter page link to it.

## Writing `desired_state`

The check runs `desired_state.query` against the learner's **current
database** and compares the result to `desired_state.rows`. Two rules shape
everything:

1. **The check inspects database state, not the learner's SQL.** You can
   only verify what the database looks like afterwards, not *how* they got
   there.
2. **Comparison is positional.** Result row 1 is compared to expected row 1
   and the row count must match exactly — so **every query needs an explicit
   `ORDER BY`** to make the order deterministic.

Only the columns you list in an expected row are compared; extra result
columns are ignored, so check just the fields that matter.

### How values are compared

The *expected* value's YAML type drives the comparison:

| Expected (YAML)  | Matches when…                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `null`           | the result is SQL `NULL` (or the column is absent)                                                                       |
| integer (`21`)   | the result is exactly that number (INTEGER or REAL)                                                                      |
| decimal (`0.5`)  | the result is within `1e-9` (floating-point tolerance)                                                                   |
| `true` / `false` | the result is `1` / `0` (SQLite has no boolean type)                                                                     |
| string           | the result is exactly that TEXT — case-sensitive, no trimming, no number↔string coercion (`"21"` ≠ the integer `21`)    |

BLOBs are not supported; integers beyond 2^53 are out of scope. Remember the
platform's YAML quoting rules: quote strings containing `key: value` text or
starting with reserved characters.

### Solutions are public

The site is static, so `desired_state` ships to the browser and a curious
learner can read the answer. That's by design — this is a learning tool, not
an accredited assessment. (The same is true of quiz answers.)

## Recipes for tougher checks

"Check the database, not the SQL" is easy for tasks that change data, but
many lessons teach things that don't naturally return rows — creating
tables, indexes, triggers, constraints, PRAGMAs. The trick is always the
same: **write a query that turns the thing you want to verify into rows**.
SQLite's catalog and `pragma_*` table-valued functions are the toolkit.

### Making read-only tasks checkable

A pure `SELECT` exercise would pass without the learner doing anything (the
seeded database already satisfies it). Give read tasks a verifiable side
effect — have learners save their query as a table:

```sql
CREATE TABLE adults AS SELECT name FROM users WHERE age >= 18 ORDER BY name;
```

then check `SELECT name FROM adults ORDER BY name;`. (If there's truly
nothing to verify, make it a sandbox instead.)

### Verifying a table's schema

`pragma_table_info(<table>)` turns structure into rows. Prefer the
table-valued function over a bare `PRAGMA` so you can `ORDER BY`:

```yaml
desired_state:
  query: "SELECT name, type, pk FROM pragma_table_info('users') ORDER BY cid;"
  rows:
    - { name: id, type: INTEGER, pk: 1 }
    - { name: name, type: TEXT, pk: 0 }
```

Columns available: `cid`, `name`, `type`, `notnull`, `dflt_value`, `pk`.
Select only the ones the exercise is about (just `notnull` for a `NOT NULL`
lesson) so unrelated details don't make the check brittle. Note: a missing
table makes `pragma_table_info` return **zero rows**, not an error — the
check simply fails, which is what you want.

### Verifying an object exists (tables, indexes, views, triggers)

`sqlite_master` has one row per schema object:

```sql
-- All user tables
SELECT tbl_name FROM sqlite_master WHERE type = 'table' ORDER BY name;

-- Did they create the expected index? (drop SQLite's auto-created ones)
SELECT name FROM sqlite_master
WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
ORDER BY name;
```

`type` is one of `table`, `index`, `view`, `trigger`. The `sql` column holds
the stored definition when *how* it was declared matters.

### Verifying data changes (INSERT / UPDATE / DELETE)

Query the affected rows back with an `ORDER BY`, selecting the columns that
should have changed. For a DELETE, assert the survivors — and `rows: []`
asserts a table is empty.

### Verifying settings and counts

```sql
SELECT foreign_keys FROM pragma_foreign_keys;   -- 1 after PRAGMA foreign_keys = ON
SELECT COUNT(*) AS n FROM orders;               -- becomes { n: <count> }
```

### General advice

- **Always `ORDER BY`.** Without it, row order is undefined and a correct
  solution can fail intermittently.
- **Check the minimum.** Select only the columns that prove the task is done.
- **Test the failure cases.** Run not just the intended solution but the
  wrong-but-close attempts you expect, and make sure they *fail* — state
  checking means an unexpected shortcut can pass.

## Sending SQL for marking (`result_endpoint`)

`result_endpoint` works for database exercises exactly as it does for
quizzes: add it next to the lesson's `database:` or the chapter's
`test_database:` and every **Check** POSTs the submission to your endpoint —
including failed attempts, so markers see the journey:

```yaml
database:
  initial_sql: ...
  desired_state: ...
result_endpoint: https://example.com/results
```

Payload (form data): `kind` (`quiz` for lessons, `test` for chapter tests),
`slug`, `title`, `submitted_at`, `sender_name`/`sender_email`, `passed`
(`true`/`false`; `n/a` when a sandbox is marked done), and `solution_sql`
(the editor buffer). Sender identity also travels as
`x-sender-name`/`x-sender-email` headers; the endpoint must handle CORS as
described in the Course Development Guide. The learner must set a profile
before Check unlocks — Run and exploration stay free.

The same caveat as always applies: **not secure, not for accredited
assessment** — answers ship in the page.

## What the learner experiences

Worth knowing when writing instructions:

- On load: a fresh database is seeded, and any previously saved SQL is
  **restored to the editor without being executed** (a banner tells them to
  re-run) — a saved buffer can't reproduce accumulated database state.
- **Run** executes the buffer and shows returned rows; the **Database**
  panel shows every table's columns, declared types, and first 50 rows.
- **Reset** wipes their SQL and re-seeds the original database — encourage
  experimentation, it's always recoverable.
- A long-running query disables the toolbar and, after a couple of seconds,
  offers **Stop**, which kills the engine and re-seeds (their SQL stays in
  the editor). Infinite loops are a learning experience, not a lockup.

## The playground

With the `sqlite` runtime enabled, `/playground/` offers a blank database
for free experimentation: the editor buffer autosaves, **Save snapshot**
persists the whole database (as SQL, re-run on the next visit), and the
export menu produces SQL text, a binary `.sqlite` file, or per-table JSON —
schema+data or schema-only. Point learners there for anything that doesn't
fit an exercise.

## Testing your exercises

1. `npm run build` — validates frontmatter shape, wiring, and that every
   used runtime is enabled.
2. In the dev server, open the exercise: write the intended solution → Run →
   Check (should pass), then try the near-miss attempts (should fail).
3. Reload mid-exercise once to see what learners see (restored buffer +
   fresh database).

Editing a shipped exercise is safe — learner progress survives content
updates. Renaming the file is not (it changes the identity and orphans
their progress); see the Course Development Guide.
