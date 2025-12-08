# Quick Story Workflow - Streamlined Feature Planning

<critical>The workflow execution engine is governed by: {workflow-engine-path}/workflow.xml</critical>
<critical>You MUST have already loaded and processed: {installed_path}/workflow.yaml</critical>
<critical>Communicate all responses in {communication_language}</critical>
<critical>Generate all documents in {document_output_language}</critical>
<critical>LIVING DOCUMENT: Write to story file CONTINUOUSLY - after EVERY section</critical>
<critical>GUIDING PRINCIPLE: A fresh Claude Code session must be able to implement this story WITHOUT asking questions</critical>
<critical>SPEED FOCUS: This is a FAST workflow - minimize interrupts, combine steps, skip fluff</critical>

<workflow>

<step n="0" goal="Quick Init">
<action>Check current git branch</action>

```bash
git branch --show-current
```

<check if="on master or main">
  <ask>Feature-Slug? (z.B. 'dark-mode-toggle') WAIT</ask>
  <action>Create branch: git checkout -b feature/{{story_slug}}</action>
</check>

<check if="already on feature branch">
  <action>Extract story_slug from branch name</action>
</check>

<action>Initialize output file with template</action>

<template-output>title</template-output>
<template-output>branch_name</template-output>
<template-output>date</template-output>
</step>

<step n="1" goal="Quick Discovery - Problem & Scope Combined" critical="true">
<action>Rapid problem capture - ask in ONE go:

"Beschreib kurz:
1. Was ist das Problem / Feature?
2. Was muss rein (MVP)?
3. Was kann warten?
4. Woran erkennst du, dass es funktioniert?"

Listen for essentials only - no deep probing unless answer is unclear.</action>

<template-output>problem_description</template-output>
<template-output>in_scope</template-output>
<template-output>out_of_scope</template-output>
<template-output>success_criteria</template-output>

<action if="risks are obvious">Document quick risk assessment</action>
<template-output>risks</template-output>
</step>

<step n="2" goal="Technical Scan - Single Agent Exploration" critical="true">
<action>Launch ONE comprehensive exploration agent

MANDATORY: Use Task tool with subagent_type="Explore"

Prompt:
"Quick technical scan for [feature].

Find and return:
1. Files to MODIFY: [exact path, what changes]
2. Files to CREATE: [path, purpose]
3. Key patterns to follow: [pattern, example file:line]
4. API/Integration points: [endpoint, types involved]

Be concise. Focus on what's needed for implementation."</action>

<action>WAIT for agent, then synthesize into compact format</action>

<template-output>affected_files</template-output>
<template-output>patterns</template-output>
<template-output>integration</template-output>

<action>Read affected files and document key change points

For EACH file to modify:
- Current code snippet (3-5 relevant lines)
- Line numbers
- What changes needed

NO exhaustive analysis - focus on what changes</action>

<template-output>code_changes</template-output>
</step>

<step n="3" goal="Acceptance Criteria & Tasks Combined" critical="true">
<action>Create compact ACs - Given/When/Then format

For each success criterion, ONE AC:
```markdown
### AC-X: [Title]
**Given:** [setup]
**When:** [action]
**Then:** [result]
**Edge:** [1-2 critical edge cases]
```

Skip exhaustive edge case analysis - focus on critical paths.</action>

<template-output>acceptance_criteria</template-output>

<action>Create implementation tasks with code details

Each task:
```markdown
**Task X: [Title]** (AC: #Y)
- File: `path/to/file.ts`
- Line: XX-YY
- Change: [brief description]
- Code:
  ```typescript
  // Before:
  old code

  // After:
  new code
  ```
```

Keep concise - details only where needed for clarity.</action>

<template-output>tasks</template-output>

<action>Define quick implementation sequence

1. Task X - Foundation
2. Task Y - Depends on #1
3. Task Z - Can parallel with #2
...</action>

<template-output>sequence</template-output>
</step>

<step n="4" goal="Quick Validation" critical="true">
<action>Run compact quality check

### Must-Haves (all must be YES)
- [ ] Problem is clear
- [ ] File paths are exact and verified
- [ ] Each task has code snippets
- [ ] ACs are testable

### Nice-to-Haves (skip if time-pressed)
- [ ] Edge cases documented
- [ ] NFRs considered
- [ ] Architecture constraints noted</action>

<template-output>testing_notes</template-output>

<action critical="true">**Self-Evaluation: Implementability Check**

Evaluate the story against these criteria (Claude decides, not user):

### Completeness Checklist
| Criterion | Required | Check |
|-----------|----------|-------|
| Problem clearly stated | YES | |
| File paths exact & verified | YES | |
| Each task has before/after code | YES | |
| ACs are testable (Given/When/Then) | YES | |
| Implementation sequence defined | YES | |
| Patterns documented | YES | |

### The Key Question
**Can a fresh Claude Code session implement this story WITHOUT asking clarifying questions?**

Evaluate:
1. Are there any ambiguous decisions left open?
2. Are there files mentioned without exact paths?
3. Are there tasks without concrete code changes?
4. Would an implementer need to ask "which approach?" or "where exactly?"

If ANY gap found → identify it, fix it in the story, re-evaluate.
If ALL criteria met → proceed to completion output.</action>

<check if="gaps found">
  <action>Add missing detail to relevant section</action>
  <action>Re-run self-evaluation until complete</action>
</check>

<output>**Quick Story Complete!**

**File:** {default_output_file}

**Summary:**
- Problem: {{problem_description}}
- Tasks: [count]
- ACs: [count]

**Next:** Fresh Claude → `/dev-story {default_output_file}`</output>
</step>

</workflow>
