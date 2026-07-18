---
title: First Queries
lessons:
  - exploring-a-database
  - filter-with-where
test_database:
  runtime: sqlite
  initial_sql: |
    CREATE TABLE books (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      pages INTEGER NOT NULL
    );
    INSERT INTO books (id, title, pages) VALUES
      (1, 'Whale Song', 320),
      (2, 'Desert Lines', 144),
      (3, 'Northern Light', 512);
  desired_state:
    query: >-
      SELECT name FROM pragma_table_info('reviews') ORDER BY cid;
    rows:
      - { name: id }
      - { name: book_id }
      - { name: rating }
  instructions: |
    Your task: create a `reviews` table with **exactly three columns, in
    this order**:

    1. `id` — INTEGER, the primary key
    2. `book_id` — INTEGER
    3. `rating` — INTEGER

    Write the `CREATE TABLE` statement, run it, and press **Check
    solution**. The check inspects your database's actual schema, so column
    names and order matter (types are up to you as long as the columns
    exist).
---

Two lessons on reading data, capped by a **database test**: instead of
questions, the test page is a SQL workspace with a task to complete against
a seeded database.
