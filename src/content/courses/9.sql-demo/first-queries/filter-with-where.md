---
title: Filter with WHERE
database:
  runtime: sqlite
  initial_sql: |
    CREATE TABLE books (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      pages INTEGER NOT NULL
    );
    INSERT INTO books (id, title, author, pages) VALUES
      (1, 'Whale Song', 'M. Okafor', 320),
      (2, 'Desert Lines', 'A. Reyes', 144),
      (3, 'Northern Light', 'J. Salo', 512),
      (4, 'Glass Harbour', 'M. Okafor', 288);
  desired_state:
    query: >-
      SELECT title FROM long_books ORDER BY title;
    rows:
      - { title: Northern Light }
      - { title: Whale Song }
---

A *checked* database exercise: the platform verifies the actual state of
your database, so it doesn't matter *how* you get there — only that the
result is right.

## Your task

Create a table called `long_books` containing the titles of every book with
**300 pages or more**. The expected result is a one-column table (`title`)
holding those books.

The idiomatic way is `CREATE TABLE … AS SELECT`:

```sql
CREATE TABLE long_books AS
SELECT title FROM books WHERE pages >= 300;
```

Run your statement, look at the **Database** panel to confirm the new table
appeared, then press **Check solution**. If it passes, the lesson completes
— and you can keep experimenting afterwards.
