---
description: 'Create a complete, implementation-ready story from a user request. One workflow, one document, ready for fresh-context implementation.'
---

# implementation-story

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS:

<steps CRITICAL="TRUE">
1. Always LOAD the FULL {project-root}/.claude/claude-workflows/workflow.xml
2. READ its entire contents - this is the CORE OS for EXECUTING the workflow
3. Pass the path {project-root}/.claude/claude-workflows/implementation-story/workflow.yaml as 'workflow-config' parameter to the workflow.xml instructions
4. Follow workflow.xml instructions EXACTLY as written
5. Save outputs after EACH section when generating documents from templates
</steps>

## What This Workflow Does

Creates a comprehensive feature implementation story with:
- Problem definition and "magic moment"
- Success metrics and scope boundaries
- Deep technical exploration (parallel agents)
- Exact file paths and line numbers
- Acceptance criteria (Given/When/Then)
- Implementation tasks with code snippets
- Testing requirements

## Expected Output

A complete story file at: `docs/stories/{slug}.md`

Ready for a fresh Claude Code session to implement without questions.
