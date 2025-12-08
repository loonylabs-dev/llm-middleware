# Quick Story Quality Checklist

Fast validation - focus on essentials only.

## Critical (Must Pass)

- [ ] Problem is clear without prior context
- [ ] ALL file paths are exact and verified (not guessed)
- [ ] Each task has code snippets showing the change
- [ ] ACs have Given/When/Then format
- [ ] A fresh Claude can implement WITHOUT questions

## Recommended (Check if Time Allows)

- [ ] Success criteria are measurable
- [ ] Edge cases documented for critical paths
- [ ] Scope boundaries are clear
- [ ] Implementation sequence is logical

## Common Quick-Story Failures

### Too Vague
- "Update the service" → WRONG
- "Update `src/services/auth.ts:45`: change X to Y" → CORRECT

### Missing Code
- "Add error handling" → WRONG
- "Wrap in try/catch, show toast on error" + code snippet → CORRECT

### Unverified Paths
- "Should be somewhere in services/" → WRONG
- "Verified at `src/services/auth.service.ts:123`" → CORRECT

## When to Use Full implementation-story Instead

Use the full workflow if:
- Feature touches 10+ files
- Multiple architectural decisions needed
- Complex integrations with external systems
- Security-critical functionality
- Team coordination required
