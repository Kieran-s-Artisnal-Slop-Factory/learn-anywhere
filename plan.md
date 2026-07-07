# Lite Learner

Lite learner is a statically generated learning management system that gives you an interactive in-browser way to learn sqlite. The project was bootstrapped using local-sync-template and is a static astro + svelte frontend that has the state of the users progress stored in indexdb. 

## What is setup

The local-sync-template app created this scaffold and set everything up. The existing code is a **starting point** to build from. It gives a good foundation for how user data is persisted and managed within the client context. Each has as part of it's schema an `id`, `updated_at`, and `deleted_at` fields, as well as `server_seq`. These fields are largely irrelevant and should be left alone since this project will not use a sync backend. 

The setup currently includes 3 main tables:

- courses
    - description (text): The description of the course in markdown
    - current_chapter (text, Nullable, foreign key of chapters.id): The current chapter of the course the user is on, null if not started
    - completed (timestamp, Nullable): When the course was completed, or null if not complteted
    - started (timestamp, Nullable): When the course was started, or null if not started
- chapters
    - description (text): The description of the chapter in markdown
    - course (text, foreign key of courses.id): The course the chapter is associated with
    - completed (timestamp, Nullable): When the chapter was completed, or null if not complteted
    - started (timestamp, Nullable): When the chapter was started, or null if not started
- exercises
    - user_solution (text): the current text representing the users solution. Allows for resumability if a user navigates off a page mid-exercise
    - completed (timestamp, Nullable): When the exercise was completed, or null if not complteted
    - started (timestamp, Nullable): When the exercise was started, or null if not started
    - initial_sql (text): The initial starting content to get the user going, will also be the value that the exercise is reset to if the user asks to reset
    - desired_state (json object): The solution information with the schema `{query: "<sql query>", rows: [{column_name: expected_value}]}` where the query is what gets run, and then the result is checked against the `rows` to see if the exercise has been completed or not

## How it should be used

From the teacher perspective:

1. Create a course with a set of chapters, exercises, and solutions. The course, chapter and exercises should be plain markdown files, and the solutions should be a JSON file. The frontmatter for the exercises should include the solution json file name. 
2. Run `npm run build` and generate a static bundle that creates pages for all the courses, chapters and exercises
3. Deploy to a static host

From the user perspective:

1. User navigates to a set of course listings
2. User goes to overview page for a course
3. User enrolls in course. The the course information is cached to the browser in indexDB
4. User goes through exercises able to have them validated using the 
4. User goes through the course


# Phase 1 (Schema Finalization and planning)

- [ ] Analyze existing project schema and layout
    - [ ] Suggest any necessary changes to acheive all the goals
- [ ] Finalize frontmatter schema for the content files
    - [ ] Solutions
    - [ ] Exercises
    - [ ] Chapters
    - [ ] Courses
- [ ] Add schema for content files to [astro content collections schema](https://docs.astro.build/en/guides/content-collections/)
- [ ] Scaffold an example course and content teaching the basics of SQLite
    - [ ] 2 chapters
        - [ ] Creating a table
            - [ ] Exercise 1.
                - [ ] `CREATE TABLE`
            - [ ] Exercise 2
                - [ ] Idempotency; understanding `CREATE TABLE IF NOT EXISTS` and re-runability in schema files
        - [ ] Creating and querying content
            - [ ] Exercise 1
                - [ ] Createing a row; `INSERT INTO`
            - [ ] Excercise 2
                - [ ] Reading a row; `SELECT`

# Phase 2

- [ ] Build out course listings page that shows off various courses
- [ ] Build out the course overview page
- [ ] Build out the chapter overview page
- [ ] Build out the exercise page
    - [ ] Build out the exercise editor component
        - [ ] Build text editor with syntax highlighting and basic warnings
        - [ ] Build out database viewer component
    - [ ] Determine how to do validation based on solutions

# Phase 3

- [ ] Build out user onboarding flow
- [ ] Build out user course onboarding flow

# Technical requirements

- **Completely static**, should be able to build and deploy the files to a static host provider
- Astro to power the generation
    - Using the content collections there should be 4 collections
        1. Solutions; This folder will contain JSON files that have a representation of a solution to a problem.    
            - Each one should have a query that gets run, and a JSON representation of what that query should produce
                - This should support checking only specific fields
                    - e.g. I have a query like `SELECT age FROM users ORDER BY age;`, then the solution JSON would look like `{query:"SELECT age FROM users ORDER BY age;", rows:[{"age":21}, {"age":30}]}` the only thing that matters is the values of the age, not the state of any other columns in the rows when the validation check is run
                - This should support inspecting tables
                    - e.g. I have a query like `PRAGMA table_info('table_name');`
        2. Exercises; These contain a description of an exercise for someone to complete
- Svelte for reactivity
    - Use svelte 5 with runes
- IndexDB to persist user state
- an in-browser editor for exercises that allows you to write SQL, execute against an in-memory sqlite wasm DB, and visually explore the state of your DB
    - Monaco editor to use as an in-browser text editor for SQL statements
        - Ideally wired up to give errors for invalid sqlite syntax
    - [sqlite wasm](https://github.com/sqlite/sqlite-wasm) as the engine to use for exercises
    - A custom DB viewer that shows your columns, their datatypes, the first 50 rows, and the ability to move between different tables that exist in the sqlite db
    - On startup
        1. Each sqlite DB should be instantiated fresh on exercise load. It should start with a blank new file
        2. run the `exercise.initial_sql` to initialize the exercise
        3. run `exercise.user_solution` if it exists to "resume" from where you stopped off before
        4. The DB viewer should fire up and show you the first table it finds in the DB  (`SELECT tbl_name FROM sqlite_master WHERE type='table' ORDER BY name LIMIT 1;`)
        5. Check on if `exercise.started` has been set, and if not set it to current time.
        6. Check on if `exercise.completed` has been set, and if so indicate this exercise is completed
    - allow user to reset which deletes the db, clears exercise.user_solution, and runs the startup process
- The entire app should after initial load function **fully offline**. Using a service worker it should cache all the page contents, js, css, etc. necessary to use all the pages normally, and if there is an available connection it should try to look for upates, but if not then serve from cache


