# Lab 1 — AI Use and Reflection

## Tools used

| Tool                   | Model / thinking level   | Where                  | What I used it for                                                                                                                                                        |
| ---------------------- | ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude (Desktop + CLI) | Opus 5<br>Extra Thinking | Course vault (`1_Uni`) | Reading, explaining and teaching me the course material — especially the parts I did not understand — and re-checking the assignment instructions before every `git push` |
| Claude (Desktop + CLI) | Opus 5<br>Extra Thinking | `toktickit` repo       | Writing and reviewing the code for this lab                                                                                                                               |
| Gemini                 | Gemini Flash 3.6         | Browser                | Short, fast answers — git commands, quick searches, and sanity-checking the review comments I wrote for my peer                                                           |

The Claude workspace is configured with its own `CLAUDE.md`, custom commands and skills, so the
agent reads the class instructions and folder conventions before it answers, instead of being told
them again in every prompt.

## Selected key prompts

| #   | Prompt name                                             | What I asked for                                                                                                               | What I did with the result                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CPE334 lab1 ใบงาน เเละเนื้อหาที่เกี่ยวข้อง              | Teach me the Git and GitHub workflow this lab requires, terminal and website                                                   | Got all the git commands, how to open a project board, how to use git, etc.<br><br>I read it carefully. Then I created a test repo to try the actual git commands, and a project board to see how it works.                                                                                                                                    |
| 2   | CPE334 lab1 สรุปทุกอย่าง ทำ guidebook เอาไว้กลับมาอ่าน  | Turn that discussion into a phase-by-phase guidebook I could follow while building                                             | Got the whole Lab 1 description and a todo list.<br><br>I read it carefully, then discussed more about what I did not understand and how to do the items on that list.<br><br>Then after a very long conversation I asked the agent to write Lab1_Guidance.md. It holds all the conversation detail, so I can open and read it any time later. |
| 3   | Issue #1 recheck and verifies before commit and open PR | Audit the foundation against its acceptance criteria and hand me a manual checklist                                            | Got a full re-test of Issue #1. It verified that I could push to GitHub, then open the PR.<br><br>I read its commands carefully to check whether they were right. Then once I was sure, I pushed and opened my first PR.                                                                                                                       |
| 4   | Issue #2 working                                        | Explore the repo, confirm my branch order was right, then write the health check                                               | Got all the code following the Issue #2 criteria.<br><br>I read its output carefully and checked the order it wrote the code in and how it tested. Then I re-tested everything myself, pushed, and opened the PR.                                                                                                                              |
| 5   | Issue #3 recheck after pull feature/2                   | Re-verify the branch with #2 merged in, then commit the merge                                                                  | Got everything verified — the current branch and commit history were right, everything worked, nothing missing.<br><br>I read its commands carefully again to make sure its tests were completely right, because this point in the branch order really mattered. Then I pushed and opened the PR for Issue #3.                                 |
| 6   | Issue #3 resolve PR changes request                     | Apply the two changes my reviewer requested, as two separate commits                                                           | Got both requested changes resolved, and tested everything again.<br><br>I verified it worked, then pushed and sent a re-request review to my peer.                                                                                                                                                                                            |
| 7   | CPE334 Lab 1 Issue #4 Category list                     | Explore the repo, then write all todo list for #4 (Because this issues is a bit large compare to before). Then complete the #4 | Got a todo list covering every Issue #4 criterion, and the code following that list.<br><br>I read the todo list and compared it against the lab sheet carefully, then read the code step by step. I re-ran every test and checked the app in the browser myself, including the failure cases.                                                 |
| 8   | CPE334 lab1 จัดการเอกสาร                                | Restructure the three lab-01 documents so they read well when rendered                                                         | Got a final document structure.<br><br>I followed that structure to make my docs easier to read.                                                                                                                                                                                                                                               |

## Reflection on improving my prompts

1. To make the AI agent work efficiently, I have to write the context clearly. The things I have to include are:
	1. What I want the agent to do
	2. Where the related documents or files are
	3. How it should do it (working constraints or limitations)
	4. What my current context on this task is
2. Do not trust the AI 100%, even when it shows its test commands, because the agent can have blind spots or, worse, hallucinate. I have to recheck and retest it myself one more time.
3. Sometimes the agent does more than it was asked to, and some of that creates conflicts later. I have to tell it clearly:
	1. What the main thing it should do is
	2. What it is not allowed to touch
4. Sometimes the agent misunderstands my prompt badly. I have to stop all the work and explain the prompt one more time, pointing out exactly which part it misunderstood and what the right reading is.

---

## Actual Prompt

### 1 — CPE334 lab1 ใบงาน เเละเนื้อหาที่เกี่ยวข้อง

```text
อ่าน C:\Users\BTCOM\Desktop\1_Uni\CPE334-software-engineering\assignment\Lab-1\Lab1_Labsheet.md
เเล้วสอนกุหน่อยว่าต้องใช้ git เเบบไหนบ้าง ขอเเบบทั้งอันที่ต้องทำบน terminal เเล้วทำบนเว็บ github จริงเลย

เเบบกุยังไม่เห็นภาพอ่ะว่าเราต้องใช้ git ยังไง เปิด pull request ยังไง issue คืออะไร ทำยังไง
เเล้ว project board มันอยู่ตรงไหน ทำให้เพื้อนตรวจยังไง เซ็ตอะไรตรงไหน ต้องทำยังไงบ้าง etc.

กุเลยอยากให้มึงช่วยสอนกุเกี่ยวกับ github เเละ coworker ทั้งหมดเลยอ่ะ รวมถึงขั้นตอนการทำงาน
ว่าโปรเจคจริงต้องทำขึ้นตอนอะไรบ้างอ่ะ ขอเนื้อหาเเบบครบๆเลย
```

### 2 — CPE334 lab1 สรุปทุกอย่าง ทำ guidebook เอาไว้กลับมาอ่าน

```text
งั้นฝากสร้าง lab1-guidance หน่อยดิ อ่านจาก
C:\Users\BTCOM\Desktop\1_Uni\CPE334-software-engineering\assignment\Lab-1\Lab1_Labsheet.md
เเล้วสร้าง instruction มาให้หน่อยว่ามี phase ไหนบ้าง ลำดับการทำคือยังไง ทำอะไร ขอเเบบ action ครบๆเลย
ตั้งเเต่การ์ดทำการ์ด ทำ PR ทำโค้ด etc. เเบบเขียนลำดับการทำงานมาให้หน่อยอ่ะ
เพราะพูดตามตรง กุอ่านเอกสารเเล้วยังงงๆอยู่เลย 🤣🤣 เอาเป็นว่ามึงใส่มาครบๆ เเน่นๆ ใส่คำอธิบายมาเต็มๆเลย
เดี๋ยวกุไปตามอ่าน เเล้วใช้อ้างอิงตอนทำ step by step
```

### 3 — Issue #1 recheck and verifies before commit and open PR

```text
ฝากเช็คงาน CPE334 lab 1 หน่อยดิ กุไปทำที่ C:\Users\BTCOM\Desktop\toktickit อ่ะ
กุคิดว่า ISSUE 1 น่าจะเสร็จเเล้วนะ เเต่ไม่เเน่ใจว่าครบเเล้วยังอ่ะ เอาเเบบละเอียดๆเลยนะ เเล้วก็สร้าง checklist มาให้กุด้วย ว่าตรวจด้วยมือยังไง เเละผลลัพธ์ควรเป็นยังไง ทำเผื่อไว้อีกรอบหนึ่ง
```

### 4 — Issue #2 working

````text
วันนี้มึงจะมาช่วยกุทำงานใน CPE334 lab 1 หน้าที่ของมึงคือช่วยกุเขียนโค้ด
กับเช็คว่ากุทำถูกต้องตาม instruction ในใบ lab มั้ย

เอกสารหลักในการอ้างอิงคือ

1. C:\Users\BTCOM\Desktop\1_Uni\CPE334-software-engineering\assignment\Lab-1\Lab1_Labsheet.md
   อันนี้เป็น official lab sheet
2. C:\Users\BTCOM\Desktop\1_Uni\CPE334-software-engineering\assignment\Lab-1\Lab1_Guidance.md
   อันนี้เป็นอันที่กุเอา official มาจัดเรียนใหม่ ตามลำดับ

ตัว local project ของกุอยู่ที่ C:\Users\BTCOM\Desktop\toktickit
เเละ root ของมึงอยู่ที่ C:\Users\BTCOM\Desktop\toktickit\1_Uni ระวังด้วย

ตอนนี้กุทำ issue #1 เสร็จเเล้ว บน feature/1-project-foundation เเละเพื่อนกุ review กับ approve เเล้ว
จากนั้นกุเลย merge feature/1-project-foundation เข้าไปที่ lab1-staging

เเละกุกำลังทำงานบน Issue #2 กุสร้าง feature/2-health-check ออกมาจาก lab1-staging ล่าสุด
ที่พึ่ง merge ไปเเล้วละ

---

สิ่งที่เหลืออยู่ตอนนี้คือ

1. เขียนโค้ดให้ครบตาม issue #2 criterial

```
Type: Feature
Branch: `feature/2-health-check`
Target: `lab1-staging`
Depends on: #1

## Acceptance criteria
- [ ] `GET /api/health` returns HTTP 200
- [ ] The JSON response contains `status = ok` and `service = TokTickIT API`
- [ ] A Supertest test verifies the endpoint
- [ ] The React page displays the backend status based on a real API call
- [ ] A useful error message appears when the backend is unavailable
```

2. Commit progress เข้า feature/2-health-check
3. push ขึ้น global สร้าง PR เเล้วก็รอเพื่อนกุ approve

(เรื่อง project board กุทำหมดเเล้ว เเต่ไม่เขียนไว้ ไม่ต้องกังวล)

---

หน้าที่ของมึงวันนี้มีเเค่ข้อ 1. ช่วยกุเขียนโค้ดกับ recheck ว่าครบ issue #2 criterial เเล้วยังเท่านั้น
เดี๋ยวที่เหลือกุจะไป test กับ recheck เเล้วทำเอง

ตอนนี้ให้มึง explore โปรเจคทั้งหมดก่อน อ่านเอกสารให้เข้าใจ เเละตรวจเช็คลำดับการทำงานของกุด้วย
ถ้าทุกอย่างปกติเรียบร้อยดี ต่อไปเราจะไปเริ่มเขียนโค้ดกัน
````

### 5 — Issue #3 recheck after pull feature/2

```text
ตอนนี้ feature2 มัน merge เข้า lab1-staging ละ (ผ่าน PR) ตอนนี้กุเลยใช้ git pull origin lab1-staging ลงมาที่ feature3 เเล้วก็เสร็จละ กุเช็คทุกอย่างน่าจะเรียบร้อยละ เหลือเเค่ commit อันนี้หลังจาก merge ขึ้นไป เเล้วก็เปิด PR เพื่อ merge เข้า lab1-staging อีกรอบอ่ะ

ตอนนี้

1. ฝากมึง retest หน่อยว่ามันเสร็จเเล้วยัง โดยใน branch feature3 ตอนนี้จะเป็น feature3 ที่สมบูรณ์ ที่มี feature2 ด้านในเเล้วอ่ะ
2. ถ้าทุกอย่างเรียบร้อยดี ฝาก commit การ update นี้อีกรอบหนึ่ง
3. เดี๋ยวที่เหลือกุไป push กับทำ PR เอง

ฝากช่วยเช็คหน่อย
```

### 6 — Issue #3 resolve PR changes request

```text
ตอนนี้กุทำ Issue #3 เสร็จหมดเเล้ว เเละก็ test กับ verify หมดเเล้ว โดย progress ตอนนี้คือ:
1. `git checkout -b feature/3-category-seed` ออกจาก lab1-staging ที่ตอนนั้นเสร็จเเค่ Issue #1
2. Issue #2 ทำเสร็จเเล้ว, merge feature/2-health-check ไปที่ lab1-staging เเล้ว
3. กลับมาที่ feature/3-category-seed, จากนั้นใช้ `git pull origin lab1-staging` ทำให้ในตอนนี้ branch ของ feature 3 มี feature 1 กับ 2 ที่เสร็จเเล้ว
4. เช็คความเรียบร้อยทุกอย่าง จากนั้น push ขึ้นไป เปิด PR เเล้ว

เเต่ว่า PR นี้เพื่อนกุกดส่ง change request มา

Summary:
The model, the migration, and the upsert seed all match the Issue #3 spec. I pulled the branch and ran npx prisma db seed twice — 4 rows both times, and createdAt did not move on the second run, so the idempotency claim holds. AC 1, 2, 3 and 5 look good to me.

Two things before I approve: a set of editor/cache files that should not be in the repository, and an error path in the seed that skips $disconnect(). Both are in the line comments.

---

On .obsidian/app.json:
This commit brings in .obsidian/ (4 files) and client/.vite/deps/ (2 files) — 248 lines of files that are not project source. .obsidian/ is per-machine editor state, and client/.vite/deps/ is Vite's dependency pre-bundle cache, which is regenerated from node_modules on every npm run dev.

Two reasons I don't want them on lab1-staging:

1. Issue #1's acceptance criteria states that .gitignore exists and node_modules is not committed. client/.vite/deps/ is pre-bundle output derived from node_modules, so committing it works around a criterion we already closed and approved.

2. _metadata.json stores content hashes and workspace.json stores which panes I had open. Both change on every machine, so once we are both running the client these will conflict on nearly every merge, for no benefit.

Could you remove both directories from the branch and add the ignore rules? Something like:

# build output & caches
.vite/
# editor/workspace state
.obsidian/

Deleting the files on their own is not enough — without the rules the next git add . puts them straight back. Worth using git rm -r --cached so they leave the index but stay on your disk.

---

On server/prisma/seed.ts:
process.exit(1) terminates the process synchronously, so the .finally() block on line 36 never runs and $disconnect() is skipped whenever the seed fails. The success path is unaffected, which is why the two clean runs in your PR description look correct — the bug only shows on the error path.

Concretely: any seed failure leaves the Postgres connection to be reaped by the server instead of closed by us. The blast radius is small today because the process is exiting anyway, but this file is the template we will copy when Lab 2 seeds more reference data, and "seed leaks a connection when it fails" is not a pattern I want us to standardize on.

process.exitCode sets the same exit status without killing the process, so the promise chain finishes and .finally() still gets to disconnect:

.catch((e) => {
  console.error(e);
  process.exitCode = 1;
})

---

วันนี้กุเลยอยากให้มึงมาช่วยเเก้ Request change ให้เสร็จ เเละ commit ให้กุอีกที (มึงเเี่เเก้ code กับ commit พอ ที่เหลือกุจัดการเอง)

ตอนนี้ให้มึง explore โปรเจคทั้งหมดก่อน อ่านเอกสารให้เข้าใจ เเละตรวจเช็คลำดับการทำงานของกุด้วย
ถ้าทุกอย่างปกติเรียบร้อยดี ต่อไปเราจะไปเริ่มเขียนโค้ดกัน
```

### 7 — CPE334 Lab 1 Issue #4 Category list

```text
วันนี้มึงจะมาช่วยกุทำงานใน CPE334 lab 1 หน้าที่ของมึงคือช่วยกุเขียนโค้ด กับเช็คว่ากุทำถูกต้องตาม instruction ในใบ lab มั้ย

เอกสารหลักในการอ้างอิงคือ

1. C:\Users\BTCOM\Desktop\1_Uni\CPE334-software-engineering\assignment\Lab-1\Lab1_Labsheet.md , อันนี้เป็น official lab sheet

2. C:\Users\BTCOM\Desktop\1_Uni\CPE334-software-engineering\assignment\Lab-1\Lab1_Guidance.md , อันนี้เป็นอันที่กุเอา official มาจัดเรียนใหม่ ตามลำดับ

ตัว local project ของกุอยู่ที่ C:\Users\BTCOM\Desktop\toktickit

เเละ root ของมึงอยู่ที่ C:\Users\BTCOM\Desktop\toktickit\1_Uni ระวังด้วย

ตอนนี้กุทำ issue #1 - Issue #3 เสร็จละ เหลือเเค่ Issue 4 ตัวเดียวเเล้ว เเล้วตอนนี้กุเอา lab1-staging ตัวล่าสุดที่ merge หมดเเล้ว เเยกออกมา branch feature/4-category-list ให้ละ

---

สิ่งที่เหลืออยู่ตอนนี้คือ

1. เขียนโค้ดให้ครบตาม issue #4 criterial

Type: Feature
Branch: `feature/4-category-list`
Target: `lab1-staging`
Depends on: #3 (must already be merged into `lab1-staging`)

## Acceptance criteria
- [ ] `GET /api/categories` retrieves categories from PostgreSQL through Prisma
- [ ] The API returns each category ID and name in a predictable order
- [ ] A Supertest test verifies the response
- [ ] React displays the categories returned by the API, not hard-coded values
- [ ] Loading and error states are shown
- [ ] A Vitest test verifies the category-list UI behavior

## Expected response
GET /api/categories → 200 OK
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]

2. Commit progress เข้า feature/4-category-list

3. push ขึ้น global สร้าง PR เเล้วก็รอเพื่อนกุ approve

(เรื่อง project board กุทำหมดเเล้ว เเต่ไม่เขียนไว้ ไม่ต้องกังวล)

---

วันนี้กุอยากให้มึงทำ:

1. ช่วยกุอ่านเอกสารทุกอย่างอีกรอบ เเล้วเขียน todo list ทั้งหมดมาว่าที่ Issue #4 เราต้อง implement อะไร ทำอะไรตรงไหนบ้าง เเบบครบๆเลย เพราะว่าอันนี้เป็น issue สุท้ายเเล้ว กุไม่อยากพลาดอะไร
    
2. จากมึงค่อยไปเขียนโค้ดทุกอย่าง ตาม todo list ที่พึ่งไปทำมา
    
3. เเละสุดท้าย เราก็จะมาทำ final test อีกที เพื่อ make sure ว่าตอนนี้มันส่งได้เเล้วจริงๆ
    

จากนั้นกุก็จะ commit เเล้วเอาไปสร้าง PR เอง

ถ้ามึงสงสัยตรงไหน สามารถถามกุได้ทุกเวลาเลย ตอนนี้ให้มึงไป Explore เอกสาร กับโค้ดทุกอย่างก่อน เเล้วเดี๋ยวต่อไปเราจะไปเริ่มทำ 1. เเล้วก็ข้ออื่นๆ step by step
```

### 8 — CPE334 lab1 จัดการเอกสาร

```text
ตอนนี้กุกำลังเติมเขื้อหาลงในเอกสารใน CPE334 lab1 อยู่อ่ะ

งานอยู่ใน C:\Users\BTCOM\Desktop\toktickit\docs\lab-01 นะ

ตอนนี้ให้มึงอ่าน lab instuction ทุกอย่างก่อน เเล้วต่อไป กุจะให้มึงมาช่วยจัด format เอกสาร เพราะว่าตอนนี้ เอกสารมันดูอ่านยากไปอ่ะ 🤣🤣👹

โดย:
1. ที่ ai_use.md ตอนนี้กุยังทำไม่เสร็จ เดี๋ยวจะมาเติมเรื่อยๆ เพราะตอนนี้พึ่งอยู่ issue 2 เอง ส่วน model หลักๆที่กุอยากให้มึงมาช่วยทำคือมาจัดหน้าให้มันอ่านง่ายมากกว่า เดี๋ยวเนื้อหากุไปเติมเอง มึงใส่เป็น [have to field ... ] ไว้ให้กุก็ได้

2. ส่วนตรง review กุเเก้ละ เเต่ฝากมึงจัดหน้าด้วย เเบบมันอ่านยากอ่ะ เพราะหัวข้อมันใหญ่ไปหมด เเล้วมันต้องเเบ่งด้วยว่าอันไหนกุ comment ไปให้เพื่อน อันไหนเพื่อน comment มาให้กุ

3. เเล้วก็ตรง tests.md ก็ฝากจัดหน้าด้วยเหมือนกัน
```

---
