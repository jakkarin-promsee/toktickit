# Lab 2 — Peer Review Record

Status: Issue #17 implementation and local verification are complete. Feature PRs through Issue #16 are
merged; the Issue #17 integration PR, its peer approval, and the Issue #18 release PR are still pending.

| Role              | Full Name         | Student ID  | GitHub username                                          |
| ----------------- | ----------------- | ----------- | -------------------------------------------------------- |
| **Author**        | Jakkarin Promsee  | 67070501009 | [@jakkarin-promsee](https://github.com/jakkarin-promsee) |
| **Peer reviewer** | Achirawish Prasom | 67070501076 | [@UsernameJillzaza](https://github.com/UsernameJillzaza) |

---

## PR index

### PRs I authored — reviewed by my partner

| PR                                                           | Issue | Title                                           | Branch                                     | Review evidence                                                                              | Verdict                |
| ------------------------------------------------------------ | ----- | ----------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------- |
| [#19](https://github.com/jakkarin-promsee/toktickit/pull/19) | #10   | Lab 2 engineering contract and test plan        | `feature/10-lab2-engineering-contract`     | [Review](https://github.com/jakkarin-promsee/toktickit/pull/19#pullrequestreview-5124427976) | ✅ Approved and merged |
| [#20](https://github.com/jakkarin-promsee/toktickit/pull/20) | #11   | Lab 2 database foundation and seed data         | `feature/11-lab2-data-foundation`          | [Review](https://github.com/jakkarin-promsee/toktickit/pull/20#pullrequestreview-5124781557) | ✅ Approved and merged |
| [#21](https://github.com/jakkarin-promsee/toktickit/pull/21) | #12   | Development Requester selection and context     | `feature/12-development-requester-context` | [Review](https://github.com/jakkarin-promsee/toktickit/pull/21#pullrequestreview-5124959364) | ✅ Approved and merged |
| [#22](https://github.com/jakkarin-promsee/toktickit/pull/22) | #13   | Requester ticket creation                       | `feature/13-create-ticket`                 | [Review](https://github.com/jakkarin-promsee/toktickit/pull/22#pullrequestreview-5125056693) | ✅ Approved and merged |
| [#23](https://github.com/jakkarin-promsee/toktickit/pull/23) | #14   | My Tickets search, filter, sort, and pagination | `feature/14-my-tickets`                    | [Review](https://github.com/jakkarin-promsee/toktickit/pull/23#pullrequestreview-5125151916) | ✅ Approved and merged |
| [#24](https://github.com/jakkarin-promsee/toktickit/pull/24) | #15   | Requester-owned Ticket Detail                   | `feature/15-requester-ticket-detail`       | [Review](https://github.com/jakkarin-promsee/toktickit/pull/24#pullrequestreview-5125237958) | ✅ Approved and merged |
| [#25](https://github.com/jakkarin-promsee/toktickit/pull/25) | #16   | Attachment upload, download, and soft removal   | `feature/16-attachment-lifecycle`          | [Review](https://github.com/jakkarin-promsee/toktickit/pull/25#pullrequestreview-5125314634) | ✅ Approved and merged |

### PRs I reviewed — authored by my partner

| PR                                                           | Issue         | Title                                                  | Branch                                | Review evidence                                                                                                                                                                                          | Verdict I gave                                          |
| ------------------------------------------------------------ | ------------- | ------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [#20](https://github.com/UsernameJillzaza/toktickit/pull/20) | #13           | Sprint specification and test plan                     | `feature/1-sprint-spec`               | [Review](https://github.com/UsernameJillzaza/toktickit/pull/20#pullrequestreview-5124714297)                                                                                                             | ✅ Approved                                             |
| [#21](https://github.com/UsernameJillzaza/toktickit/pull/21) | #14           | Development Requester context                          | `feature/2-requester-context`         | [Changes requested](https://github.com/UsernameJillzaza/toktickit/pull/21#pullrequestreview-5124827506) · [Approval](https://github.com/UsernameJillzaza/toktickit/pull/21#pullrequestreview-5124954024) | ❌ Changes requested, then ✅ approved                  |
| [#22](https://github.com/UsernameJillzaza/toktickit/pull/22) | #15           | Category and Related System reference data             | `feature/3-reference-data`            | [Review](https://github.com/UsernameJillzaza/toktickit/pull/22#pullrequestreview-5125077902)                                                                                                             | ✅ Approved                                             |
| [#23](https://github.com/UsernameJillzaza/toktickit/pull/23) | #16           | Ticket creation                                        | `feature/4-ticket-creation`           | [Review](https://github.com/UsernameJillzaza/toktickit/pull/23#pullrequestreview-5125146709)                                                                                                             | ✅ Approved                                             |
| [#24](https://github.com/UsernameJillzaza/toktickit/pull/24) | #17           | My Tickets list                                        | `feature/5-my-tickets`                | [Review](https://github.com/UsernameJillzaza/toktickit/pull/24#pullrequestreview-5125199501)                                                                                                             | ✅ Approved                                             |
| [#25](https://github.com/UsernameJillzaza/toktickit/pull/25) | #18           | Ticket Detail and Attachments                          | `feature/6-ticket-detail-attachments` | [Review](https://github.com/UsernameJillzaza/toktickit/pull/25#pullrequestreview-5125259663)                                                                                                             | ✅ Approved                                             |
| [#26](https://github.com/UsernameJillzaza/toktickit/pull/26) | #19           | Zen Green UI polish and responsive pass                | `feature/7-ui-polish`                 | [Review](https://github.com/UsernameJillzaza/toktickit/pull/26#pullrequestreview-5125332893)                                                                                                             | ✅ Approved                                             |
| [#27](https://github.com/UsernameJillzaza/toktickit/pull/27) | Documentation | Lab 2 documentation: reviewer record and AI use report | `feature/8-lab2-docs`                 | [Review](https://github.com/UsernameJillzaza/toktickit/pull/27#pullrequestreview-5125404347)                                                                                                             | ✅ Approved; PR still open when this record was updated |

## Notable comments, responses, and resolutions

### Changes requested on my partner's PR #21

- **My review:** I requested changes because the initial implementation auto-selected the first Requester, never disabled Continue, trusted unvalidated `localStorage` data, and appeared to conflict with the contract I was reading. [Read the full changes-requested review](https://github.com/UsernameJillzaza/toktickit/pull/21#pullrequestreview-5124827506).
- **Author response:** The author changed the selector to start with a placeholder, disabled Continue until a valid choice was made, added storage-shape validation and tests, and explained that the model/API mismatch came from comparing two independently specified repositories. [Read the response](https://github.com/UsernameJillzaza/toktickit/pull/21#issuecomment-5558299752).
- **Resolution:** I rechecked the API, client behavior, tests, and authentication boundary, then approved the corrected PR. [Read the approval](https://github.com/UsernameJillzaza/toktickit/pull/21#pullrequestreview-5124954024).

### Question received on my PR #22

- **Reviewer comment:** My partner identified that `findAvailableTicketNumber` was imported but the production creation path implemented its own database-backed retry loop, leaving the tested helper unused, and asked whether this was intentional. [Read the line comment](https://github.com/jakkarin-promsee/toktickit/pull/22#discussion_r3943672501).
- **My response:** I acknowledged the review comment in the PR discussion. [Read the response](https://github.com/jakkarin-promsee/toktickit/pull/22#issuecomment-5558684398).
- **Resolution:** The reviewer treated the question as non-blocking after verifying that the database unique constraint and retry path were the actual production safeguard, then approved the PR. [Read the approval](https://github.com/jakkarin-promsee/toktickit/pull/22#pullrequestreview-5125056693).
