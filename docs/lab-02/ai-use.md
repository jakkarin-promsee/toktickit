# Lab 02 — AI Use Disclosure

## Tool Used

- **AI tool:** Cursor
- **Models:** GPT-5.6 Sol, GPT-5.6 Luna, and Cursor Composer 2.5
- **Purpose:** Requirement analysis, implementation planning, coding assistance, test design, debugging, and pre-PR review.

## Prompt History

| #   | Selected key prompt                                                                                                                                          | Purpose / Outcome                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Read and analyze the Lab 02 labsheet. Explain unclear requirements before writing any document or code.                                                      | Helped me verify my understanding of the assignment and resolve unclear scope before implementation.                                       |
| 2   | Summarize the labsheet into GitHub Issues and Pull Requests with dependencies, acceptance criteria, branch names, and test evidence.                         | Converted the large PDF into nine manageable Issues and established the complete staging and release workflow.                             |
| 3   | Analyze and write the requirements, out-of-scope items, and test checklist for Issue #N.                                                                     | Gave each Issue a testable scope and a checklist that I could review before implementation and before opening its PR.                      |
| 4   | Read the approved specification, API specification, UI specification, and test plan. Identify conflicts or ambiguities before coding.                        | Found inconsistencies early and reduced the risk of silently implementing behavior that was not part of the approved contract.             |
| 5   | Write the failing unit, API, or UI tests for the current Issue first, then implement only the smallest behavior needed to pass them.                         | Supported the TDD workflow and kept each implementation focused on the acceptance criteria of its Issue.                                   |
| 6   | Audit requester ownership, validation boundaries, safe errors, attachment limits, and soft-removal behavior. Do not add authentication or IT Staff features. | Checked important failure and cross-requester cases while keeping the implementation within Lab 2 scope.                                   |
| 7   | Run the complete server, client, responsive, and E2E suites. Compare the implementation and screenshots against the engineering contract.                    | Exposed integration and evidence gaps, including shared-database pollution, incomplete responsive coverage, and missing screenshot states. |
| 8   | Perform a final pre-PR review. Identify unnecessary files, misleading test results, untested requirements, and documentation that is no longer current.      | Prevented an early “done” claim and produced a concrete list of corrections required before peer review.                                   |


## My Reflection and Critical Review

1. To make an AI agent work efficiently, I have to provide clear context instead of assuming that it already understands the task.
   - **What:** Clearly state what I want the agent to do and what result I expect.
   - **Where:** Provide the paths to all related requirements, specifications, tests, and implementation files.
   - **How:** Explain the required workflow, constraints, and limitations, such as using TDD, staying on the correct branch, or not changing files outside the current Issue.
   - **Current context:** Explain what has already been completed, what is currently being worked on, and any known problems or decisions that affect the task.
2. I should never trust AI output completely, even when the agent shows test commands and reports that they passed, because it can have blind spots or hallucinate. For example, the audit found that E2E tests left Ticket records in the shared database and caused later server tests to fail even though the test document reported the suites as passing. I corrected this by giving server tests and Playwright separate reset-and-seed PostgreSQL schemas and temporary Attachment storage, then reran every documented suite.
3. An AI agent may implement more than it was asked to do, and those extra changes can create conflicts in later Issues. I have to state both the main task it must complete and the files, features, or behaviors it is not allowed to change. Explicit out-of-scope instructions helped keep authentication, IT Staff workflow, comments, and later status transitions outside Lab 2.
4. Sometimes an AI agent significantly misunderstands a prompt. When this happens, I have to stop the current work instead of allowing it to continue in the wrong direction, identify the exact part it misunderstood, explain the correct interpretation, and restate the expected result and constraints before asking it to continue.

My main lesson is that AI can accelerate requirement analysis, implementation, and testing, but clear context and strict scope control are necessary. I remain responsible for reviewing the result, testing it independently, correcting misunderstandings, and deciding whether the evidence is sufficient to declare the work complete.

