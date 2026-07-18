1. Add support for numeric answers in normal quizzes/tests (non-web, non-db)
	1. Two options
		1. single numbers (e.g. 7)
		2. multiple comma-separated values (e.g. 7,9, 10, 25)
	2. Ability to specify only being able to enter positive values, or any values
	3. Ability to specify integers or floats
		1. Allow a specification of how many decimals to be accurate to (e.g. if answer is 4.3875, and precision is 3, then 4.3879 would be correct)
	4. Ability to specify tuples (e.g. (10,15), (12.4, -36.2))
	5. If partial marks are enabled give people partial marks for a question being right
	6. Update documentation and course with details
2. Clean up documentation
	1. move all markdown files that are not the README to `/docs`
	2. do a quick pass over README.md and improve/update it
	3. add section about how to add images to `/docs/user/images.md`, add this to the course as well