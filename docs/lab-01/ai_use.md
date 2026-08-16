# Lab 1 — AI Use and Reflection

## Tools used

| Tool | Model / thinking level | Where | What I used it for |
| --- | --- | --- | --- |
| Claude (Desktop + CLI) | [TO FILL: model name, e.g. Opus 5, and thinking level] | Course vault (`1_Uni`) | Reading, explaining and teaching me the course material — especially the parts I did not understand — and re-checking the assignment instructions before every `git push` |
| Claude (Desktop + CLI) | [TO FILL: model name] | `toktickit` repo | Writing and reviewing the code for this lab |
| Gemini | [TO FILL: model name] | Browser | Short, fast answers — git commands, quick searches, and sanity-checking the review comments I wrote for my peer |

The Claude workspace is configured with its own `CLAUDE.md`, custom commands and skills, so the
agent reads the class instructions and folder conventions before it answers, instead of being told
them again in every prompt.

## Selected key prompts

| # | Prompt name | Used during | Tool |
| --- | --- | --- | --- |
| 1 | CPE334 lab1 ใบงาน เเละเนื้อหาที่เกี่ยวข้อง | Planning — before any code | Claude (vault) |
| 2 | CPE334 lab1 ใบงาน เเละเนื้อหาที่เกี่ยวข้อง (สรุปทุกอย่าง ทำ guidebook เอาไว้กลับมาอ่าน) | Planning — after ~20 discussion prompts | Claude (vault) |
| 3 | Issue #1 recheck and verifies before commit and open PR | Issue #1, before opening the PR | Claude (vault → repo) |
| 4 | Issue #2 working | Issue #2, implementation | Claude (repo) |
| 5 | [TO FILL: prompt name] | Issue #3 | [TO FILL] |
| 6 | [TO FILL: prompt name] | Issue #4 | [TO FILL] |
| 7 | [TO FILL: prompt name] | [TO FILL] | [TO FILL] |
| 8 | [TO FILL: prompt name] | [TO FILL] | [TO FILL] |

> The lab sheet asks for 6–10 prompts. Slots 5–8 are placeholders — delete any that stay unused.

---

### 1 — CPE334 lab1 ใบงาน เเละเนื้อหาที่เกี่ยวข้อง

**Context:** run inside the course vault, where the agent can grep every class document and reads
`CLAUDE.md` for the doc index and class-specific context.

```text
อ่าน C:\Users\BTCOM\Desktop\1_Uni\CPE334-software-engineering\assignment\Lab-1\Lab1_Labsheet.md
เเล้วสอนกุหน่อยว่าต้องใช้ git เเบบไหนบ้าง ขอเเบบทั้งอันที่ต้องทำบน terminal เเล้วทำบนเว็บ github จริงเลย

เเบบกุยังไม่เห็นภาพอ่ะว่าเราต้องใช้ git ยังไง เปิด pull request ยังไง issue คืออะไร ทำยังไง
เเล้ว project board มันอยู่ตรงไหน ทำให้เพื้อนตรวจยังไง เซ็ตอะไรตรงไหน ต้องทำยังไงบ้าง etc.

กุเลยอยากให้มึงช่วยสอนกุเกี่ยวกับ github เเละ coworker ทั้งหมดเลยอ่ะ รวมถึงขั้นตอนการทำงาน
ว่าโปรเจคจริงต้องทำขึ้นตอนอะไรบ้างอ่ะ ขอเนื้อหาเเบบครบๆเลย
```

**Reflection:** [TO FILL: 1–3 sentences]

### 2 — CPE334 lab1 ใบงาน เเละเนื้อหาที่เกี่ยวข้อง (สรุปทุกอย่าง ทำ guidebook เอาไว้กลับมาอ่าน)

**Context:** after the discussion above was finished (~20+ prompts), I asked for a step-by-step
guidebook covering everything from an empty folder to the end of Issue #4, to read back later.

```text
งั้นฝากสร้าง lab1-guidance หน่อยดิ อ่านจาก
C:\Users\BTCOM\Desktop\1_Uni\CPE334-software-engineering\assignment\Lab-1\Lab1_Labsheet.md
เเล้วสร้าง instruction มาให้หน่อยว่ามี phase ไหนบ้าง ลำดับการทำคือยังไง ทำอะไร ขอเเบบ action ครบๆเลย
ตั้งเเต่การ์ดทำการ์ด ทำ PR ทำโค้ด etc. เเบบเขียนลำดับการทำงานมาให้หน่อยอ่ะ
เพราะพูดตามตรง กุอ่านเอกสารเเล้วยังงงๆอยู่เลย 🤣🤣 เอาเป็นว่ามึงใส่มาครบๆ เเน่นๆ ใส่คำอธิบายมาเต็มๆเลย
เดี๋ยวกุไปตามอ่าน เเล้วใช้อ้างอิงตอนทำ step by step
```

**Reflection:** [TO FILL: 1–3 sentences]

### 3 — Issue #1 recheck and verifies before commit and open PR

**Context:** run from the course vault, but pointed at the local project folder.

```text
ฝากเช็คงาน CPE334 lab 1 หน่อยดิ กุไปทำที่ C:\Users\BTCOM\Desktop\toktickit อ่ะ
กุคิดว่า ISSUE 1 น่าจะเสร็จเเล้วนะ เเต่ไม่เเน่ใจว่าครบเเล้วยังอ่ะ เอาเเบบละเอียดๆเลยนะ
```

**Reflection:** [TO FILL: 1–3 sentences]

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

**Reflection:** [TO FILL: 1–3 sentences]

### 5 — [TO FILL: prompt name]

```text
[TO FILL: paste the actual prompt text]
```

**Reflection:** [TO FILL]

### 6 — [TO FILL: prompt name]

```text
[TO FILL: paste the actual prompt text]
```

**Reflection:** [TO FILL]

### 7 — [TO FILL: prompt name]

```text
[TO FILL: paste the actual prompt text]
```

**Reflection:** [TO FILL]

### 8 — [TO FILL: prompt name]

```text
[TO FILL: paste the actual prompt text]
```

**Reflection:** [TO FILL]

---

## Reflection on improving my prompts

[TO FILL: 2–3 short paragraphs. What made the prompts better — for example pasting the acceptance
criteria in verbatim, naming the exact files to read, stating what NOT to do, splitting the work
into one small task at a time.]

[TO FILL: one place where I had to correct or reject what the agent produced, and why I was right
to overrule it.]
