---
description: 'Fast, compact story for medium-sized features. ~50% faster than implementation-story with same quality core.'
---

# quick-story

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS:

<steps CRITICAL="TRUE">
1. Always LOAD the FULL {project-root}/.claude/claude-workflows/workflow.xml
2. READ its entire contents - this is the CORE OS for EXECUTING the workflow
3. Pass the path {project-root}/.claude/claude-workflows/quick-story/workflow.yaml as 'workflow-config' parameter to the workflow.xml instructions
4. Follow workflow.xml instructions EXACTLY as written
5. Save outputs after EACH section when generating documents from templates
</steps>

## What This Workflow Does

Creates a compact, fast feature story with:
- Problem definition and scope (combined in one step)
- Single agent exploration (focused technical scan)
- Exact file paths and line numbers
- Acceptance criteria (Given/When/Then)
- Implementation tasks with code snippets
- Quick validation

**Speed Focus:**
- 4 steps instead of 8 (vs implementation-story)
- 1 exploration agent instead of 3
- Fewer user checkpoints
- Compact template (~15 fields vs ~30)
- Optimized for #yolo mode

## When to Use

Use this workflow when:
- Feature is medium-sized (3-8 files affected)
- Requirements are relatively clear
- Time is a constraint
- You want fast iteration

## Expected Output

A complete story file at: `docs/stories/{slug}.md`

Ready for a fresh Claude Code session to implement without questions.
