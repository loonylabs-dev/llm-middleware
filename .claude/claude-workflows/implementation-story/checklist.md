# Implementation Story Quality Checklist

Use this checklist to validate the story before marking it complete.

## 1. Problem & Context (Step 1)

- [ ] Problem description is specific and concrete
- [ ] Affected users are identified
- [ ] Frequency/impact is quantified where possible
- [ ] Magic moment is clearly articulated
- [ ] Differentiator explains what makes this solution special

## 2. Success & Scope (Step 2)

- [ ] Success metrics are MEASURABLE (not vague)
- [ ] In-scope items are clearly bounded
- [ ] Out-of-scope items are explicitly listed
- [ ] No scope creep (nice-to-haves moved to out-of-scope)
- [ ] Risks have mitigations defined
- [ ] Dependencies are listed

## 3. Technical Exploration (Step 3)

- [ ] ALL affected files identified with EXACT paths
- [ ] File actions are clear (MODIFY vs CREATE)
- [ ] Patterns to follow are documented with examples
- [ ] Integration points are mapped
- [ ] No files missing from analysis

## 4. Technical Deep-Dive (Step 4)

- [ ] Each affected file has LINE NUMBERS for changes
- [ ] Before/After code snippets are provided
- [ ] Injection flow is documented (data path through system)
- [ ] ALL technical decisions are FINAL (no "or" statements)
- [ ] NFRs are documented where relevant

## 5. Acceptance Criteria (Step 5)

- [ ] EVERY AC has Given/When/Then format
- [ ] EVERY AC has a test approach (manual or automated)
- [ ] EVERY AC has edge cases documented
- [ ] ACs are TESTABLE (can objectively verify)
- [ ] ACs are SPECIFIC (no ambiguity)

## 6. Implementation Tasks (Step 6)

- [ ] Each task has EXACT file path
- [ ] Each task has LINE NUMBERS
- [ ] Each task has Before/After code snippets
- [ ] Each task maps to specific ACs
- [ ] Task dependencies are clear
- [ ] Implementation sequence is defined
- [ ] Parallel vs sequential tasks are marked

## 7. Dev Notes (Step 7)

- [ ] Architecture constraints are documented
- [ ] Testing requirements are clear (curl commands, test steps)
- [ ] References to related code with file:line

## 8. Final Validation (Step 8)

### The Ultimate Test
**Can a fresh Claude Code session implement this WITHOUT asking questions?**

Check:
- [ ] No missing information
- [ ] No assumptions
- [ ] No ambiguous decisions
- [ ] All code locations are verified (not guessed)
- [ ] All patterns are documented with examples

## Common Failure Modes

### Insufficient Detail
- "Modify the controller" → WRONG
- "Modify `src/controllers/user.controller.ts:45-67`, change X to Y" → CORRECT

### Unverified Paths
- "Should be in src/services/" → WRONG
- "Verified at `src/services/auth.service.ts:123`" → CORRECT

### Vague Decisions
- "Could use approach A or B" → WRONG
- "Using approach A because [rationale]" → CORRECT

### Missing Edge Cases
- "Handle errors appropriately" → WRONG
- "On network error: show toast, retry 3x, then show offline state" → CORRECT
