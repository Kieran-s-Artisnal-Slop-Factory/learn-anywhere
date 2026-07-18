---
title: Using the database workspace
database:
  runtime: sqlite
  initial_sql: |
    CREATE TABLE visitors (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
    INSERT INTO visitors (id, name) VALUES (1, 'Ada');
  desired_state:
    query: SELECT COUNT(*) AS visitors FROM visitors
    rows:
      - visitors: 2
---

The workspace beside this text is a **real SQLite database running in your
browser**. Nothing is sent anywhere — close the tab and reopen it and your
SQL is still here.

## The parts

- **The editor** — type any SQL and press **Run** to execute it. Results
  (and errors) appear right below.
- **The Database panel** — shows every table's current contents, refreshed
  after each run. It's the actual state of your database, not a mock-up.
- **Check** — exercises with a goal (like this one) have a Check button
  that inspects the *state of the database*, not the text of your SQL — any
  approach that produces the right state passes, and passing completes the
  lesson.
- **Stop** — if a query runs away, Stop aborts it and reseeds a fresh
  database (your editor text is kept).
- **Reset** — puts the database back to its starting state so you can
  retry cleanly.

## Try it now

The task here: make it so the `visitors` table has **two** rows. For
example:

```sql
INSERT INTO visitors (name) VALUES ('Grace');
```

Press **Run**, watch the Database panel update, then press **Check**.

## Beyond lessons

Chapter *tests* use this same workspace on a full page, with the task text
shown above it. And if this site has a **Playground** link in the
navigation, that's the same editor with no task at all — a scratch database
that persists between visits, with export options.
