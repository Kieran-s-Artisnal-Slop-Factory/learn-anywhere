/**
 * Ready-made SQLite databases for the playground. Selecting a template wipes
 * the current database and runs its `sql` against a blank one. Each is a
 * self-contained schema + seed data — no dependencies between templates.
 */
export interface PlaygroundTemplate {
  id: string;
  name: string;
  description: string;
  sql: string;
}

const MOVIES = `-- Movies with per-source ratings and an aggregated view.
CREATE TABLE directors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT
);

CREATE TABLE movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  year INTEGER,
  runtime INTEGER,          -- minutes
  genre TEXT,
  director_id INTEGER REFERENCES directors(id)
);

-- Individual ratings from different sources; aggregate them in the view below.
CREATE TABLE ratings (
  id INTEGER PRIMARY KEY,
  movie_id INTEGER NOT NULL REFERENCES movies(id),
  source TEXT NOT NULL,     -- e.g. 'Critics', 'Audience', 'Festival'
  score REAL NOT NULL       -- out of 10
);

INSERT INTO directors (id, name, country) VALUES
  (1, 'Christopher Nolan', 'United Kingdom'),
  (2, 'Greta Gerwig', 'United States'),
  (3, 'Bong Joon-ho', 'South Korea'),
  (4, 'Hayao Miyazaki', 'Japan'),
  (5, 'Denis Villeneuve', 'Canada');

INSERT INTO movies (id, title, year, runtime, genre, director_id) VALUES
  (1, 'Inception', 2010, 148, 'Sci-Fi', 1),
  (2, 'Interstellar', 2014, 169, 'Sci-Fi', 1),
  (3, 'Lady Bird', 2017, 94, 'Drama', 2),
  (4, 'Little Women', 2019, 135, 'Drama', 2),
  (5, 'Parasite', 2019, 132, 'Thriller', 3),
  (6, 'Spirited Away', 2001, 125, 'Animation', 4),
  (7, 'Dune', 2021, 155, 'Sci-Fi', 5),
  (8, 'Arrival', 2016, 116, 'Sci-Fi', 5);

INSERT INTO ratings (movie_id, source, score) VALUES
  (1, 'Critics', 8.8), (1, 'Audience', 9.1),
  (2, 'Critics', 8.6), (2, 'Audience', 8.9),
  (3, 'Critics', 9.0), (3, 'Audience', 7.4),
  (4, 'Critics', 8.4), (4, 'Audience', 7.8),
  (5, 'Critics', 9.5), (5, 'Audience', 8.5), (5, 'Festival', 10.0),
  (6, 'Critics', 9.6), (6, 'Audience', 8.6),
  (7, 'Critics', 8.0), (7, 'Audience', 8.4),
  (8, 'Critics', 8.2), (8, 'Audience', 7.9);

-- Aggregated rating per movie: average score and number of ratings.
CREATE VIEW movie_ratings AS
SELECT
  m.id,
  m.title,
  ROUND(AVG(r.score), 2) AS avg_score,
  COUNT(r.id)            AS num_ratings
FROM movies m
LEFT JOIN ratings r ON r.movie_id = m.id
GROUP BY m.id, m.title;

-- Try:  SELECT * FROM movie_ratings ORDER BY avg_score DESC;`;

const USERS = `-- A single table of application users.
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  age INTEGER,
  city TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,   -- 1 = active, 0 = deactivated
  signup_date TEXT NOT NULL               -- ISO 8601 date
);

INSERT INTO users (username, email, full_name, age, city, is_active, signup_date) VALUES
  ('ada',    'ada@example.com',    'Ada Lovelace',    36, 'London',    1, '2023-01-15'),
  ('alan',   'alan@example.com',   'Alan Turing',     41, 'Manchester',1, '2023-02-02'),
  ('grace',  'grace@example.com',  'Grace Hopper',    52, 'New York',  1, '2023-02-19'),
  ('linus',  'linus@example.com',  'Linus Torvalds',  33, 'Portland',  0, '2023-03-08'),
  ('margaret','margaret@example.com','Margaret Hamilton',44,'Boston',  1, '2023-04-01'),
  ('dennis', 'dennis@example.com', 'Dennis Ritchie',  49, 'Summit',    1, '2023-04-27'),
  ('katherine','kat@example.com',  'Katherine Johnson',60,'Hampton',   1, '2023-05-14'),
  ('tim',    'tim@example.com',    'Tim Berners-Lee', 39, 'Oxford',    0, '2023-06-30');

-- Try:  SELECT city, COUNT(*) FROM users WHERE is_active = 1 GROUP BY city;`;

const NOTES = `-- A note-taking app: notes, their body text (stored separately),
-- tags, and a many-to-many relation between notes and tags.
CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,      -- ISO 8601
  pinned INTEGER NOT NULL DEFAULT 0
);

-- Body text lives in its own table (one row per note) so listing notes
-- doesn't have to read every note's full content — join when you need it.
CREATE TABLE note_contents (
  note_id INTEGER PRIMARY KEY REFERENCES notes(id),
  body TEXT NOT NULL
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Many-to-many: a note can have many tags, a tag many notes.
CREATE TABLE note_tags (
  note_id INTEGER NOT NULL REFERENCES notes(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (note_id, tag_id)
);

INSERT INTO notes (id, title, created_at, pinned) VALUES
  (1, 'Grocery list', '2024-01-03', 0),
  (2, 'Project ideas', '2024-01-05', 1),
  (3, 'Reading list', '2024-01-09', 0),
  (4, 'Meeting notes', '2024-01-12', 0),
  (5, 'SQLite tips', '2024-01-15', 1);

INSERT INTO note_contents (note_id, body) VALUES
  (1, 'Milk, eggs, bread, coffee, spinach.'),
  (2, 'Build a personal wiki. Learn a new language. Write a SQL course.'),
  (3, 'The Pragmatic Programmer. Designing Data-Intensive Applications.'),
  (4, 'Discussed Q1 roadmap. Action: draft the schema by Friday.'),
  (5, 'Use WITHOUT ROWID for key-value tables. Index your foreign keys.');

INSERT INTO tags (id, name) VALUES
  (1, 'personal'),
  (2, 'work'),
  (3, 'ideas'),
  (4, 'learning');

INSERT INTO note_tags (note_id, tag_id) VALUES
  (1, 1),
  (2, 2), (2, 3),
  (3, 1), (3, 4),
  (4, 2),
  (5, 4);

-- Try: list each note with its tags and body —
--   SELECT n.title, group_concat(t.name) AS tags, c.body
--   FROM notes n
--   JOIN note_contents c ON c.note_id = n.id
--   LEFT JOIN note_tags nt ON nt.note_id = n.id
--   LEFT JOIN tags t ON t.id = nt.tag_id
--   GROUP BY n.id;`;

const SCHOOL = `-- A school timetable planner: students, teachers, rooms, and the
-- classes that tie them together, plus student enrolments.
CREATE TABLE teachers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL
);

CREATE TABLE rooms (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL
);

CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  grade INTEGER NOT NULL
);

-- A scheduled class: taught by a teacher, in a room, on a day and period.
CREATE TABLE classes (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id),
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  day TEXT NOT NULL,        -- 'Mon'..'Fri'
  period INTEGER NOT NULL   -- 1..6
);

-- Many-to-many: which students are in which classes.
CREATE TABLE enrollments (
  student_id INTEGER NOT NULL REFERENCES students(id),
  class_id INTEGER NOT NULL REFERENCES classes(id),
  PRIMARY KEY (student_id, class_id)
);

INSERT INTO teachers (id, name, subject) VALUES
  (1, 'Mr. Keating', 'English'),
  (2, 'Ms. Frizzle', 'Science'),
  (3, 'Mr. Escalante', 'Mathematics'),
  (4, 'Ms. Norbury', 'Mathematics');

INSERT INTO rooms (id, name, capacity) VALUES
  (1, 'Room 101', 30),
  (2, 'Lab A', 24),
  (3, 'Room 205', 30),
  (4, 'Auditorium', 120);

INSERT INTO students (id, name, grade) VALUES
  (1, 'Alice', 10),
  (2, 'Bob', 10),
  (3, 'Carlos', 11),
  (4, 'Dana', 11),
  (5, 'Ethan', 10),
  (6, 'Fatima', 12);

INSERT INTO classes (id, title, teacher_id, room_id, day, period) VALUES
  (1, 'English Literature', 1, 1, 'Mon', 1),
  (2, 'Biology',           2, 2, 'Mon', 2),
  (3, 'Calculus',          3, 3, 'Tue', 1),
  (4, 'Algebra II',        4, 3, 'Wed', 3),
  (5, 'Chemistry',         2, 2, 'Thu', 2);

INSERT INTO enrollments (student_id, class_id) VALUES
  (1, 1), (1, 3),
  (2, 1), (2, 2),
  (3, 3), (3, 4),
  (4, 2), (4, 5),
  (5, 1), (5, 4),
  (6, 3), (6, 5);

-- Try: find room clashes (same room, day, and period used twice) —
--   SELECT room_id, day, period, COUNT(*) AS classes
--   FROM classes GROUP BY room_id, day, period HAVING COUNT(*) > 1;`;

export const TEMPLATES: PlaygroundTemplate[] = [
  {
    id: 'movies',
    name: 'Movies',
    description: 'Films, directors, and per-source ratings with an aggregated view.',
    sql: MOVIES,
  },
  {
    id: 'users',
    name: 'Users',
    description: 'A single table of application users.',
    sql: USERS,
  },
  {
    id: 'notes',
    name: 'Notes',
    description: 'A notes app: notes, separate body text, tags, and note↔tag relations.',
    sql: NOTES,
  },
  {
    id: 'school',
    name: 'School',
    description: 'Timetable planner: students, teachers, classes, and rooms.',
    sql: SCHOOL,
  },
];
