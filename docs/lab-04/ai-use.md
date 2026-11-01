# AI Use Disclosure

## Tool Used

- **AI tools:** Claude (Desktop / CLI), Chat GPT/Codex (Desktop / web client), Cursor, and Gemini.
- **Models:** Different models were selected depending on task complexity and availability. More capable reasoning models were used for requirement analysis, cross-file review, and complex debugging, while faster models were used for focused implementation questions and quick checks.
- **Purpose:** Understanding requirements, planning implementation, drafting specifications, coding assistance, test design, debugging, documentation, and reviewing work before submission.

## Prompt History

| #   | Selected key prompt                                                                                                                                                                                      | Purpose / Outcome                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Read the assignment instructions and related course material carefully. Explain the requirements, expected deliverables, and any unclear points before suggesting an implementation.                     | Helped me understand the task and identify questions or ambiguities before starting the work. I used the explanation as a reference, not as a replacement for reading the original instructions. |
| 2   | Summarize the requirements into a step-by-step implementation plan, including dependencies, acceptance criteria, and a checklist of work to complete.                                                    | Made the assignment more manageable and gave me a structured checklist to compare against the original requirements.                                                                             |
| 3   | Read the existing repository, relevant specifications, and current progress. Identify any conflicts, missing information, or risks before changing code.                                                 | Helped establish the project context and reduce the chance of making changes based on incorrect assumptions.                                                                                     |
| 4   | For the current task, check the relevant requirements and working branch, propose a short to-do list, and implement only the agreed scope. Do not change unrelated features or commit without my review. | Kept the work focused and made it easier for me to review the proposed changes before deciding what to accept.                                                                                   |
| 5   | Help design and implement appropriate unit, API, or UI tests based on the acceptance criteria, including invalid inputs, error handling, and important edge cases.                                       | Helped identify test scenarios beyond the normal success path and provided a basis for checking whether the implementation met the stated requirements.                                          |
| 6   | Review the code and test results against the specifications. Point out missing coverage, unexpected behavior, and any claims that are not supported by actual test evidence.                             | Encouraged a more critical review instead of assuming that AI-generated code or a reported passing test was automatically correct.                                                               |
| 7   | Investigate the reported error using the relevant code, logs, and reproduction steps. Explain the likely cause and suggest the smallest fix without introducing unrelated changes.                       | Helped narrow down problems and compare possible solutions while keeping the final debugging and verification decisions under my control.                                                        |
| 8   | Review the user interface, where applicable, for consistency with the approved design, responsiveness, accessibility, loading states, and error states. Report specific issues before changing anything. | Provided additional quality checks for user-facing functionality without treating visual suggestions as new requirements.                                                                        |
| 9   | Perform a final review of the requirements, implementation, tests, documentation, and submission checklist. Clearly distinguish verified results from anything that still needs manual checking.         | Helped organize the final verification and identify possible omissions before I decided whether the work was ready to submit or open for review.                                                 |

## My Reflection and Critical Review

### Reflection on improving my prompts

1. I learned that effective AI assistance depends on giving clear context instead of assuming the agent already understands my project. A useful prompt should specify:
   1. **What:** The exact task and expected result.
   2. **Where:** The relevant assignment instructions, specifications, code, and test files.
   3. **How:** The intended workflow, constraints, and limits on what may be changed.
   4. **Current context:** What is already complete, what I am working on now, and any known problems or decisions.

2. I should use AI to understand and break down complex requirements, not just to generate code. Asking it to explain unclear concepts, organize tasks, and identify contradictions helps me make implementation decisions based on the original assignment rather than on its assumptions.

3. I cannot fully trust an AI agent's output, even when it presents test commands or claims that everything passes. I need to inspect the actual changes, run the relevant tests myself, check important edge cases, and compare the results with the acceptance criteria. A test should only be reported as passed when it has actually been executed and its result is available.

4. I learned to control the scope of each request. AI can sometimes add extra functionality or modify unrelated files, which may create new problems. I should state both what it must do and what it must not touch, and review the proposed plan before allowing larger changes.

5. When the AI misunderstands a requirement, I should stop the task and clarify the specific mistake rather than let it continue. Referring back to the original instructions and restating the expected behavior usually gives better results than repeating a vague prompt.

6. AI is useful in different roles, but those roles should be kept distinct:
   1. **Learning and planning assistant:** Explains course concepts, analyzes requirements, and helps organize tasks and specifications.
   2. **Coding assistant:** Suggests or implements changes within the agreed requirements and existing project structure.
   3. **Reviewer and testing assistant:** Looks for missing cases, inconsistencies, defects, and gaps between the implementation and its evidence.

7. I learned that a final review should cover more than whether the code runs. Documentation, test evidence, repository hygiene, and submission requirements also matter. Re-reading the original assignment at the end helps catch details that can be overlooked after several implementation steps.

8. I remain responsible for the final work. AI suggestions are inputs to my decision-making, not proof of correctness. I should understand the changes, verify their behavior, resolve any remaining issues, and personally decide when the work is ready for a commit, pull request, or submission.

Overall, AI is most valuable to me as a learning, development, and review assistant. Clear prompts, explicit boundaries, independent verification, and human oversight make its use more reliable and help me learn from the process rather than simply accepting its output.
