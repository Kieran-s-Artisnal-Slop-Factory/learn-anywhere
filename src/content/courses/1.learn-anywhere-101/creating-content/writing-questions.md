---
title: Writing Questions
quiz:
  - type: multiple_choice
    prompt: "In a multiple-choice question, `answer: 2` means…"
    options:
      - The second option is correct
      - The third option is correct
      - Two options are correct
      - The answer is worth 2 points
    answer: 1
  - type: multiple_choice
    prompt: How do you make "All of the above" the correct answer?
    options:
      - "`all_of_the_above: true` and `answer: all`"
      - "Add it as a normal option"
      - "`answer: -1`"
    none_of_the_above: true
    answer: 0
  - type: multi_select
    prompt: Which statements about written answers are true?
    options:
      - They are never auto-graded
      - They don't count toward the score
      - short_answer is one line, long_answer is a textarea
      - They can be sent to a result endpoint for human marking
    answer: [0, 1, 2, 3]
  - type: short_answer
    prompt: Write a plausible `prompt:` for a true/false question about markdown.
---

Quizzes and [[chapter-test|tests]] share one question format — an array in
frontmatter. Five types:

```yaml
quiz:
  - type: multiple_choice     # 2–5 options, rendered a–e
    prompt: Pick one
    options: [First, Second, Third]
    answer: 1                 # 0-based index → "Second"

  - type: true_false
    prompt: This is easy.
    answer: true

  - type: multi_select        # answer = the EXACT set of correct indices
    prompt: Pick all that apply
    options: [A, B, C, D]
    answer: [0, 2]

  - type: short_answer        # one line, recorded but never graded
    prompt: Summarize this lesson.

  - type: long_answer         # multi-line, same non-grading rules
    prompt: Discuss in a paragraph.
```

## All / None of the above

Both are opt-in **per question** and are appended after your options:

```yaml
  - type: multiple_choice
    prompt: Which apply?
    options: [Only a real option, Another real option]
    all_of_the_above: true    # appends "All of the above"
    none_of_the_above: true   # appends "None of the above", always last
    answer: all               # or none, or still a numeric index
```

Enable one and keep a numeric `answer` and it works as a distractor — this
lesson's second question does exactly that.

## The build has your back

Answer indices out of range, `answer: all` without `all_of_the_above`,
duplicate multi-select indices — all fail `npm run build` with a message
pointing at the file. Written answers are excluded from the score
(`correct/gradable` counts only the gradable kinds), which matters for the
[[result-endpoint]] workflow in the next chapter.
