---
description: 'Create a minimal bug-fix story. Focuses on IST vs. SOLL, root cause analysis, and clear fix documentation.'
---

# Bug Fix Story

**Goal:** Document a bug so clearly that a fresh Claude Code session can fix it without questions.

**Template:** `docs/templates/bug-story.md`
**Output:** `docs/stories/bug-{{slug}}.md`

---

# PHASE 0: BRANCH CHECK

## 0.1 Verify Branch

**Before anything else, check the current git branch.**

```bash
git branch --show-current
```

- If on `master` or `main`: **Stop and create a branch first**
- Branch naming: `bug/{{slug}}`

```
"Du bist aktuell auf master. Ich erstelle einen Branch für diesen Bug-Fix.
Wie soll der Bug-Slug heißen? (z.B. 'floating-menu-crash')"
```

Then:
```bash
git checkout -b bug/{{slug}}
```

**QUALITY GATE:** Do not proceed on master/main.

---

# PHASE 1: BUG UNDERSTANDING

## 1.1 Current Behavior (IST)

```
"Was passiert aktuell? Beschreib das fehlerhafte Verhalten."
```
- Capture exact error messages, wrong outputs, crashes
- Capture: `current_behavior`

```
"Wie reproduziert man den Bug?"
```
- Step-by-step reproduction
- Capture: `reproduction_steps`

**If unclear, ask:**
```
"Was genau klickst/machst du bevor der Fehler auftritt?"
"Passiert es immer oder nur manchmal?"
"Gibt es eine Fehlermeldung? Wie lautet sie genau?"
```

---

## 1.2 Expected Behavior (SOLL)

```
"Was sollte stattdessen passieren?"
```
- Be specific: not "it should work" but "it should show X"
- Capture: `expected_behavior`

**Challenge vague answers:**

| Vague | Challenge |
|-------|-----------|
| "Es soll funktionieren" | "Was genau soll passieren? Was sieht der User?" |
| "Kein Crash" | "Was soll stattdessen angezeigt werden?" |
| "Normales Verhalten" | "Beschreib das normale Verhalten Schritt für Schritt" |

---

## 1.3 Confirm Understanding

Summarize:
```
**IST:** [exact current behavior]
**SOLL:** [exact expected behavior]
**Reproduktion:** [steps]
```

Ask: "Habe ich den Bug richtig verstanden?"

**QUALITY GATE:** Do not proceed until confirmed.

---

# PHASE 2: ANALYSIS & FIX DOCUMENTATION

## 2.1 Root Cause Analysis

Search the codebase for relevant files:
- Find where the buggy behavior originates
- Trace the code path
- Identify the exact location of the bug

Document:
```
**Affected Files:**
| File | Role in Bug |
|------|-------------|

**Root Cause:**
[Exact explanation of why the bug occurs]

**Code Context:**
[Relevant code snippets, function names, line references]
```

---

## 2.2 Fix Description

Define the fix clearly:
```
**Required Changes:**
1. In `[file]`: [what to change]
2. In `[file]`: [what to change]
...
```

**No ambiguity allowed:**
- NOT: "Fix the logic"
- BUT: "Change condition from `x > 0` to `x >= 0` in line 42"

- NOT: "Handle the error"
- BUT: "Add try-catch around API call, show toast on failure"

---

## 2.3 Verification

```
"Wie testet man, dass der Bug behoben ist?"
```

Document:
```
**Verification Steps:**
1. [Step to verify the fix]
2. [Step to verify no regression]
...
```

---

## 2.4 Present Summary

```
"Bug-Analyse abgeschlossen:

**IST:** [behavior]
**SOLL:** [behavior]
**Root Cause:** [cause]
**Fix:** [summary]
**Files:** [count] affected

Soll ich die Bug-Story erstellen?"
```

---

# PHASE 3: DOCUMENT GENERATION

## 3.1 Generate Document

Use template `docs/templates/bug-story.md` and fill ALL sections.

**Required completeness:**
- [ ] IST-Verhalten ist spezifisch und reproduzierbar
- [ ] SOLL-Verhalten ist eindeutig
- [ ] Alle betroffenen Dateien mit Pfaden gelistet
- [ ] Root Cause erklärt das "Warum"
- [ ] Fix-Beschreibung ist eindeutig (kein "oder")
- [ ] Verifikationsschritte sind testbar

---

## 3.2 Final Check

```
"Kann ein frischer Claude Code Chat diesen Bug ohne Nachfragen fixen?"
```

- [ ] IST/SOLL klar unterscheidbar
- [ ] Reproduktion verifiziert
- [ ] Root Cause identifiziert
- [ ] Alle Dateien gelistet
- [ ] Fix-Ansatz eindeutig
- [ ] Keine impliziten Annahmen

If yes → Save to `docs/stories/bug-{{slug}}.md`
If no → Return to relevant phase

---

# QUICK REFERENCE

```
PHASE 0: BRANCH CHECK
└── 0.1 [GATE] Nicht auf master/main?

PHASE 1: UNDERSTANDING
├── 1.1 Was passiert aktuell? (IST)
├── 1.2 Was sollte passieren? (SOLL)
└── 1.3 [GATE] Bug richtig verstanden?

PHASE 2: ANALYSIS
├── 2.1 Root Cause finden (Codebase durchsuchen)
├── 2.2 Fix beschreiben (eindeutig, kein "oder")
├── 2.3 Verifikation definieren
└── 2.4 Summary präsentieren

PHASE 3: DOCUMENT
├── 3.1 Template ausfüllen
└── 3.2 [FINAL] Kann frischer Chat das fixen?
```
