I want to add support for code-based evaluations.  For now I just want you to **plan** this feature since it's quite large. Split the whole featureset up into phases, and split each type up into phases that can be implemented and tested as you go. Put the plan in `coding-exams-plan.md`

 Split up each type into:

1. Phase 1: initial implementation
   1. Get something working that I can play with and make sure the implementation makes sense and is workable
   2. Focus is on how solutions are stored (if applicable), what dependencies are needed, and how the schemas need to change to support the feature
2. Phase 2: Polish
   1. Ensuring the UI makes sense, and adding any polish necessary

3. Phase 3: Document
   1. Write full documentation for creating content around the feature `docs/user/<feature>.md`
   2. Write full documentation with code references and sequence diagrams for how the feature was implemented `docs/dev/<filename>.md`

There will need to be 3 types:

1. Database-based; I have included references to `lite-learner` which is a project that already implements what I'm looking for 
   1. A codemirror-based code editor that users enter their SQL into, and then starting schemas and expected results to evaluate against
   2. Currently it just uses SQLite, but in the future it will be expanded to other wasm runtimes like pglite for postgres in browser. It also features a playground implementation
   3.  db viewer that would need to be ported with it
   4. You can change the current frontmatter schema, and evaluation methods if you have to, but this will need to be tested
2. Web-preview based; Specifically for situations where you want to do website design, and need access to HTML, css and JS. 
   1. Will need tabs for each content type (HTML, css, JS) and a preview
   2. Ideally the code editor used should also implement emmet abbreviations to make answering easier
   3. Should support typescript or JS
   4. Does not need to be evaluated, but should be able to:
      1.  store the user results
      2. export them as a zip
      3. export a preview screenshot (full page or just viewport)
3. pure code; Will use something like a WASM runtime to evaluate the results and print to a terminal-emulator. Useful for languages like python, go, rust, etc
   1. This will require some way to do per-runtime configuration to bring in the WASM environment, and setup the validation

There are some more requirements:

1. I will need to be able to set them per-exercise, while still supporting normal quizes/tests
   1. E.g. a course might have a lesson, then the next lesson is a multiple choice exercise, then a database-based exercise, then a database-based test
2. I need some method to tell the system that a site will need the dependencies installed to make this work
3. The system needs to be extensible to other runtimes in the pure code case, and I will need documentation on how to go about implementing them
4. They should also bring a playground along with them for people to experiment in for each type 
   1. Will need to be able to switch between them if multiple languages are installed
5. Need to support some sort of unit-testing based evaluation that is language agnostic, and can just be brought across