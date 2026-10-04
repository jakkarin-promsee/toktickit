# Lab 03 — AI Use Disclosure

## Tool Used

- **AI tools:** Claude Code (desktop app)
- **Models:**
  - Claude Opus 5.5 : Used for complex task like whole pdf analyze and planing, recheck all feature across many issues, or validate test cases scenario.
  - Sonnet 5.5 : Used for straight task that have all criteria and workflow, such as implement each isolate issues.
- **Purpose:** Requirement analysis, Issue planning, specification drafting, implementation, test design, debugging, visual and accessibility auditing, and pre-PR review. The repository's knowledge-graph tool was deliberately not used because the Lab 3 graph had no content.

## Prompt History

| #   | Selected key prompt                                                                                                                                                                                                                                                                                                                                                      | Purpose / Outcome                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Read and analyze the Lab 03 labsheet. Explain unclear requirements before writing any document or code. Teach me all thing I should know.                                                                                                                                                                                                                                | Helped me verify my understanding of the assignment and resolve unclear scope before implementation.                                                                                              |
| 2   | Read and understand `Lab_3_sheet.md`, then help me implement Issue #N. First check that the current git branch is correct, then write a todo list of everything to do, then implement it until done, then report whether it is ready for a PR or which parts I still have to do and should to validate. Do not commit or write the PR yet; I will review the code first. | Stay on the working routine. Gave every Issue the same shape: branch check, visible plan, implementation, and an honest readiness report, while keeping branch, commits and PRs under my control. |
| 3   | Audit the tests from each Issues against the FR/BR/AC and the approved Test DD matrix, add the missing coverage, and update `tests.md` with actual file paths, final status, and evidence commands. Do not mark anything Pass without a recorded run.                                                                                                                    | Found missing files and thin suites, and turned `tests.md` into a record backed by real files and two clean runs (Issue #38).                                                                     |
| 4   | Prove the critical Lab 3 workflows through the browser and the real backend, including negative authorization cases, using deterministic data that never touches development data.                                                                                                                                                                                       | Produced the four E2E specs with direct API checks from the same browser session and an isolated `lab3_e2e` schema (Issue #39).                                                                   |
| 5   | Audit every major screen against `ui-spec.md` for Zen Green consistency, responsiveness, and accessibility, fix only real defects, and collect desktop, tablet, and mobile screenshot evidence with before/after pairs. Do this one in detail.                                                                                                                           | Captured "before" evidence first, fixed the defects the audit and visual review exposed, and built responsive, accessibility, and visual suites (Issue #40).                                      |
| 6   | Go back to read lab 03 sheet deeply and help me recheck doc/lab-03 assignment requirement. Then summarize me a thing I lack and should do next to complete this lab task.                                                                                                                                                                                                | Helped me recheck that I actual complete all lab task in both coding side and document side.                                                                                                      |
| 7   | Help me recheck everything last round again, before close this PR which is the last round we edit anything. (Next issues is just merging lab3 staging to main, has no any commit new)                                                                                                                                                                                    | Helped me confirm everything last round. Make sure that I didn't miss anything.                                                                                                                   |
| 8   | Go back to read lab 03 sheet deeply and tell me all slide criteria. Then give me a detail which slide part should look like. Then the last, verify my slide.pdf to make sure that it's complete before the actual sending.                                                                                                                                               | Help me verify my understanding of the assignment and help me read huge of criteria.                                                                                                              |

## My Reflection and Critical Review

## Reflection on improving my prompts

1. I learned that giving the AI a clear working routine makes its output more consistent. A good prompt should tell the agent:
   1. What task or Issue it is working on
   2. Which documents or requirements it must follow
   3. What steps it should do before implementation
   4. What it must report before I decide to commit or open a PR

2. I should not only ask the AI to implement features. I can also use it as a reviewer to audit:
   1. FR/BR/AC coverage
   2. Missing or weak tests
   3. Authorization and negative cases
   4. UI consistency, responsiveness, and accessibility
   5. Final submission requirements and evidence

3. I learned that test results should be backed by real evidence. I should not let the AI mark something as complete or Pass only because it thinks the code looks correct. I have to make sure that:
   1. The actual test file exists
   2. The test was really executed
   3. The result is recorded
   4. The result matches the requirement or acceptance criterion

4. Rechecking the original lab sheet is useful near the end of the project. After working on many Issues, it is easy to focus only on the implementation and forget a document, evidence item, or submission requirement. A final requirement audit helps find those missing parts.

5. I should keep important decisions under my control. I prefer letting the AI implement, test, and report readiness first, while I review the changes before allowing commits, PRs, or final integration.
