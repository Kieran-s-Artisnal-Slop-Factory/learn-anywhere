---
title: Exploring a Database
database:
  runtime: sqlite
  initial_sql: |
    CREATE TABLE books (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      pages INTEGER NOT NULL,
      rating REAL
    );
    INSERT INTO books (id, title, author, pages, rating) VALUES
      (1, 'Whale Song', 'M. Okafor', 320, 4.5),
      (2, 'Desert Lines', 'A. Reyes', 144, 3.8),
      (3, 'Northern Light', 'J. Salo', 512, 4.9),
      (4, 'Glass Harbour', 'M. Okafor', 288, NULL);
---

Welcome to a **database lesson**. On the right (or below, on a narrow
screen) is a real SQLite database running in your browser — the editor runs
whatever SQL you type, and the **Database** panel shows every table's
current contents.

This one is a *sandbox*: there's nothing to solve. Poke around, then press
**Mark as done** when you're comfortable.

## Try these

```sql
SELECT * FROM books;
```

```sql
SELECT title, pages FROM books ORDER BY pages DESC;
```

```sql
SELECT author, COUNT(*) AS written FROM books GROUP BY author;
```

Notice the fourth book's rating is `NULL` — the viewer renders it in
italics. **Reset** discards everything you've done and re-seeds the original
data, so experiment freely.
