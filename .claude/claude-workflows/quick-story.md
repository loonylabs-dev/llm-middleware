---
description: 'Fast, compact story for medium-sized features. ~50% faster than implementation-story with same quality core.'
---

# quick-story

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS:

<steps CRITICAL="TRUE">
1. Always LOAD the FULL {workflow-engine-path}/workflow.xml
2. READ its entire contents - this is the CORE OS for EXECUTING the workflow
3. Pass the path {workflow-engine-path}/quick-story/workflow.yaml as 'workflow-config' parameter to the workflow.xml instructions
4. Follow workflow.xml instructions EXACTLY as written
5. Save outputs after EACH section when generating documents from templates
</steps>

## Setup Instructions

Before using this workflow, ensure:

1. **Copy workflow files to your project:**
   - Copy the entire `claude-workflows` folder contents to your project's `.claude/` directory
   - Or keep it in a shared location and reference it

2. **Variable Resolution:**
   - `{workflow-engine-path}` = Path where workflow.xml is located
   - `{project-root}` = Your project's root directory
   - `{workflow-dir}` = Path to quick-story folder

3. **Project Structure:**
   - Ensure `docs/stories/` folder exists (or will be created)
   - Git repository initialized

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

## When to Use quick-story

Use this workflow when:
- Feature is medium-sized (3-8 files affected)
- Requirements are relatively clear
- Time is a constraint
- You want fast iteration

## When to Use implementation-story Instead

Use the full implementation-story workflow when:
- Feature touches 10+ files
- Multiple architectural decisions needed
- Complex integrations with external systems
- Security-critical functionality
- Team coordination required

## Expected Output

A complete story file at: `docs/stories/{slug}.md`

Ready for a fresh Claude Code session to implement without questions.
