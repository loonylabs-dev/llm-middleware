# Implementation Story Workflow - Intent-Driven Feature Planning

<critical>The workflow execution engine is governed by: {workflow-engine-path}/workflow.xml</critical>
<critical>You MUST have already loaded and processed: {installed_path}/workflow.yaml</critical>
<critical>Communicate all responses in {communication_language}</critical>
<critical>Generate all documents in {document_output_language}</critical>
<critical>LIVING DOCUMENT: Write to story file CONTINUOUSLY - after EVERY section, not at the end</critical>
<critical>GUIDING PRINCIPLE: A fresh Claude Code session must be able to implement this story WITHOUT asking questions</critical>
<critical>TECHNICAL DEPTH: Every code change must have exact file paths, line numbers, and before/after code snippets</critical>

<workflow>

<step n="0" goal="Branch Check and Story Initialization">
<action>Check current git branch</action>

```bash
git branch --show-current
```

<check if="on master or main">
  <output>**Du bist aktuell auf master/main.**

Ich erstelle einen Feature-Branch für dieses Feature.</output>
  <ask>Wie soll der Feature-Slug heißen? (z.B. 'dark-mode-toggle', 'user-auth-flow') WAIT</ask>
  <action>Create branch: git checkout -b feature/{{story_slug}}</action>
</check>

<check if="already on feature branch">
  <action>Extract story_slug from branch name</action>
  <output>Bereits auf Feature-Branch: {{branch_name}}</output>
</check>

<action>Set branch_name = current branch</action>
<action>Initialize output file with template</action>

<template-output>title</template-output>
<template-output>branch_name</template-output>
<template-output>date</template-output>
</step>

<step n="1" goal="Discovery - Problem and Context" critical="true">
<action>Gather comprehensive problem understanding through conversation

Ask progressively:
1. "Was genau ist das Problem / was soll gebaut werden?"
2. "Wer ist davon betroffen? Wie oft tritt das auf?"
3. "Kannst du ein konkretes Beispiel geben?"

Listen for:
- Current pain points
- User impact
- Technical debt indicators
- Frequency of occurrence

If answer is vague, probe deeper:
- "Was passiert aktuell wenn jemand X versucht?"
- "Zeig mir wo das Problem auftritt"</action>

<template-output>problem_description</template-output>
<template-output>affected_users</template-output>

<action>Discover the magic moment

Ask:
- "Was wäre der Wow-Moment? Wann würde ein User sagen 'das ist genau was ich brauchte'?"
- "Was unterscheidet diese Lösung von einer 'okay' Lösung?"

This magic becomes the thread woven through the entire story.</action>

<template-output>magic_moment</template-output>
<template-output>differentiator</template-output>

<ask>Habe ich das Problem richtig verstanden? (y/n/edit) WAIT</ask>
</step>

<step n="2" goal="Success Definition and Scope">
<action>Define measurable success criteria

Ask: "Woran erkennst du, dass es funktioniert?"

CHALLENGE VAGUE ANSWERS:
| Vague | Challenge With |
|-------|----------------|
| "Es soll schnell sein" | "Was heißt schnell? Unter 200ms? Unter 1s?" |
| "User sollen es mögen" | "Wie misst du das? Was ist ein Signal dafür?" |
| "Es soll funktionieren" | "Was genau muss funktionieren? Kritischer Pfad?" |
| "Bessere UX" | "Was genau ist besser? Weniger Klicks? Klareres Feedback?" |

Convert to MEASURABLE:
- NOT: "10.000 User" → BUT: "100 Power-User die täglich darauf angewiesen sind"
- NOT: "Schnelle Ladezeit" → BUT: "Response in unter 2s nach Klick"</action>

<template-output>success_metrics</template-output>

<action>Define scope boundaries

Ask:
- "Was MUSS in dieser Iteration rein? Absolutes Minimum?"
- "Was wäre nice-to-have aber kann warten?"

CHALLENGE SCOPE CREEP:
- "Muss [X] wirklich jetzt rein, oder kann das ein Follow-up sein?"
- "Was passiert wenn wir [X] erstmal weglassen?"
- "Ist [X] kritisch für den Wow-Moment oder ein Extra?"</action>

<template-output>in_scope</template-output>
<template-output>out_of_scope</template-output>

<action>Identify risks and dependencies

Ask:
- "Was könnte schiefgehen?"
- "Was muss vorher existieren oder funktionieren?"
- "Gibt es Deadlines oder externe Constraints?"</action>

<template-output>risks_table</template-output>
<template-output>dependencies</template-output>
<template-output>constraints</template-output>

<ask>Sind Success-Kriterien und Scope klar definiert? (y/n/edit) WAIT</ask>
</step>

<step n="3" goal="Technical Exploration - Deep Codebase Analysis" critical="true">
<action>Launch 3 parallel exploration agents for comprehensive codebase analysis

MANDATORY: Use Task tool with subagent_type="Explore" for EACH agent</action>

<action>Agent 1: Affected Code Analysis

Prompt for Task tool:
"Analyze the codebase for [feature area].

Find:
1. All files that need modification (with EXACT paths)
2. Current implementation state of related code
3. Patterns used in similar code
4. Test files that exist

Return structured:
- Files to MODIFY: [exact path, current purpose, what changes needed]
- Files to CREATE: [exact path, purpose]
- Test files: [path, what coverage exists]
- Patterns observed: [pattern name, example file with line numbers]"</action>

<action>Agent 2: Pattern & Architecture Analysis

Prompt for Task tool:
"Find architectural patterns for [feature type].

Analyze:
1. How similar features are implemented
2. Naming conventions used
3. File/folder structure patterns
4. Error handling patterns
5. State management patterns

Return:
- Patterns to follow: [pattern, example file:line_number]
- Conventions: [naming, structure examples]
- Anti-patterns to avoid: [what, why, where seen]"</action>

<action>Agent 3: Integration & Data Flow Analysis

Prompt for Task tool:
"Analyze integration points for [feature].

Find:
1. API endpoints involved (frontend ↔ backend)
2. Data models / types affected
3. State management touchpoints
4. External dependencies

Return:
- API contracts: [endpoint, method, request body, response]
- Types/Interfaces: [name, exact file:line_number]
- Data flow: [source → transformation → destination]
- Dependencies: [internal, external]"</action>

<action>WAIT for all agents to complete, then synthesize findings</action>

<template-output>affected_files_table</template-output>
<template-output>existing_patterns</template-output>
<template-output>integration_points</template-output>

<ask>Sind alle betroffenen Dateien und Patterns identifiziert? (y/n/explore more) WAIT</ask>
</step>

<step n="4" goal="Technical Deep-Dive - Code-Level Details" critical="true">
<action>For EACH affected file, read and document:

1. EXACT current code that will change
2. Line numbers for modification points
3. Before/After code snippets
4. Import changes needed

Create a TECHNICAL INJECTION FLOW diagram showing:
- How data flows from entry point to destination
- Each transformation step with file:line references
- Where new code will be inserted</action>

<template-output>technical_deep_dive</template-output>

<action>Document all technical decisions

For each decision point:
- What are the options?
- What is the chosen approach?
- WHY this approach? (rationale)
- What are the trade-offs?

NO "OR" STATEMENTS ALLOWED - every decision must be FINAL</action>

<template-output>decisions_table</template-output>

<action>Check NFRs that matter for THIS feature

Only document if relevant:
- Performance: Response time targets?
- Security: Sensitive data handling?
- Error Handling: What happens on failure?
- Accessibility: Keyboard/screen reader needs?</action>

<template-output>nfr_performance</template-output>
<template-output>nfr_security</template-output>
<template-output>nfr_error_handling</template-output>
<template-output>nfr_accessibility</template-output>

<invoke-task halt="true">{workflow-engine-path}/adv-elicit.xml</invoke-task>
</step>

<step n="5" goal="Acceptance Criteria Definition" critical="true">
<action>For EACH success metric, create testable Acceptance Criteria

FORMAT (mandatory):
```markdown
### AC-X: [Descriptive Title]

**Given:** [precondition/setup - be specific]
**When:** [action/trigger - exact user action or system event]
**Then:** [expected outcome - measurable result]

**Test:** [How to verify - manual steps or automated test approach]
**Edge Cases:**
- [edge case 1]: [expected behavior]
- [edge case 2]: [expected behavior]
```

QUALITY CHECK for each AC:
- [ ] Is it testable? (Can write a test for it)
- [ ] Is it specific? (No ambiguity)
- [ ] Is it complete? (Covers the requirement fully)
- [ ] Are edge cases covered?</action>

<template-output>acceptance_criteria</template-output>

<action>Document all edge cases and error scenarios

| Scenario | Expected Behavior | How to Handle |
|----------|-------------------|---------------|

Common patterns to consider:
- Empty states
- Loading states
- Error states
- Boundary values
- Invalid input
- Network failures
- Concurrent access
- Race conditions</action>

<template-output>edge_cases_table</template-output>

<ask>Sind alle ACs testbar und vollständig? (y/n/edit) WAIT</ask>
</step>

<step n="6" goal="Implementation Tasks with Code Details" critical="true">
<action>Create implementation tasks with FULL technical details

Each task MUST include:
1. Exact file path
2. Exact line numbers for changes
3. Before/After code snippets
4. Which ACs it fulfills
5. Dependencies on other tasks

FORMAT:
```markdown
**Task X: [Title] (AC: #Y, #Z)**
- Datei: `exact/path/to/file.ts`
- Zeile: XX-YY
- Änderung:
  ```typescript
  // VORHER (Zeile XX):
  existing code here

  // NACHHER:
  new code here
  ```
- Dependencies: Task X-1
```</action>

<template-output>tasks_with_ac_mapping</template-output>

<action>Define implementation sequence

```
1. Task X - Foundation, no dependencies
2. Task Y - Depends on #1
3. Task Z - Can parallel with #2
...
```

Mark which tasks can run in parallel vs sequential</action>

<template-output>implementation_sequence</template-output>

<invoke-task halt="true">{workflow-engine-path}/adv-elicit.xml</invoke-task>
</step>

<step n="7" goal="Dev Notes and Testing Requirements">
<action>Document architecture constraints

- What patterns MUST be followed?
- What approaches are forbidden?
- Where should new code live?</action>

<template-output>architecture_constraints</template-output>

<action>Document testing requirements

Include:
- Manual test steps (curl commands, browser actions)
- Unit test requirements
- Integration test needs</action>

<template-output>testing_requirements</template-output>

<action>Add references to relevant code

- Key files with line numbers
- Related documentation
- Similar implementations to reference</action>

<template-output>references</template-output>
</step>

<step n="8" goal="Final Validation and Quality Check" critical="true">
<action>Run through COMPLETE quality checklist

### Completeness
- [ ] Problem is clear without prior context
- [ ] Magic moment is explicit
- [ ] Scope boundaries are unambiguous
- [ ] All technical decisions are final (no "or" options)

### Technical Accuracy
- [ ] ALL file paths are exact and verified (not guessed)
- [ ] ALL line numbers are current and verified
- [ ] Patterns match existing codebase
- [ ] Integration points are correct
- [ ] No assumptions about code that doesn't exist

### Implementation Readiness
- [ ] A fresh Claude session can start IMMEDIATELY
- [ ] NO questions would need to be asked
- [ ] All dependencies are available
- [ ] Test approach is clear

### Testability
- [ ] EVERY AC has Given/When/Then format
- [ ] EVERY AC has a test approach
- [ ] Edge cases have expected behaviors
- [ ] Success can be objectively verified</action>

<ask critical="true">**FINAL VALIDATION:**

Kann ein frischer Claude Code Chat dieses Dokument nehmen und das Feature OHNE NACHFRAGEN implementieren?

- Ja → Speichern und abschließen
- Nein → Zurück zu relevantem Schritt

(y/n) WAIT</ask>

<check if="no">
  <ask>Welcher Bereich braucht mehr Details? WAIT</ask>
  <action>Go back to relevant step and add missing details</action>
</check>

<template-output>effort_estimate</template-output>

<output>**Implementation Story Complete!**

**Erstellt:** {default_output_file}

**Zusammenfassung:**
- Problem: {{problem_description}}
- Magic: {{magic_moment}}
- Scope: {{in_scope}}
- Tasks: [count] mit exakten Code-Details
- ACs: [count] testbare Kriterien

**Nächster Schritt:**
Ein frischer Claude Code Chat kann jetzt `/dev-story {default_output_file}` ausführen um die Implementierung zu starten.</output>
</step>

</workflow>
