# Claude Code Workflows (XML/YAML Engine)

This folder contains Claude Code workflow commands powered by a strict XML/YAML execution engine for guaranteed workflow compliance.

## Folder Structure

```
claude-workflows/
├── workflow.xml                    # Workflow execution engine
├── adv-elicit.xml                  # Advanced elicitation task
├── adv-elicit-methods.csv          # Elicitation methods database
├── templates/                      # Story output templates
│   ├── bug-story.md               # Bug fix story template
│   └── implementation-story.md    # Feature story template
├── implementation-story.md         # Command entry point (full workflow)
├── implementation-story/           # Workflow configuration
│   ├── workflow.yaml              # Workflow definition
│   ├── instructions.md            # Step-by-step instructions
│   ├── story-template.md          # Output template
│   └── checklist.md               # Quality checklist
├── quick-story.md                  # Command entry point (fast workflow)
├── quick-story/                    # Workflow configuration
│   ├── workflow.yaml              # Workflow definition
│   ├── instructions.md            # Step-by-step instructions
│   ├── story-template.md          # Output template
│   └── checklist.md               # Quality checklist
├── bug-fix.md                      # Bug fix workflow
└── README.md                       # This file
```

---

## How It Works

### The XML/YAML Engine

The **workflow.xml** is an execution engine that:
- ✅ **Enforces step order** - Steps execute in exact numerical sequence
- ✅ **Auto-saves** - Saves to file after every `<template-output>` tag
- ✅ **Enforces gates** - Waits for user confirmation at quality checkpoints
- ✅ **Executes tasks** - Runs `<invoke-task>` commands (e.g., adv-elicit)
- ✅ **Resolves variables** - Handles `{project-root}`, `{workflow-engine-path}`, etc.

This ensures workflows execute **exactly as designed** without Claude skipping or reordering steps.

---

## Installation

### Option 1: Project-Specific (Recommended)

Copy the entire `claude-workflows` folder to your project:

```bash
cp -r claude-workflows /path/to/your/project/.claude/
```

Then in your project's `.claude/commands/` create a symlink or wrapper:

```bash
# In .claude/commands/implementation-story.md
---
description: 'Create implementation story'
---

Load and execute: {project-root}/.claude/claude-workflows/implementation-story.md
```

### Option 2: Shared Location

Keep workflows in a shared location (like this USB stick) and reference them:

```bash
# In .claude/commands/implementation-story.md
---
description: 'Create implementation story'
---

Load and execute: /path/to/shared/claude-workflows/implementation-story.md
```

---

## Available Workflows

### 1. implementation-story

**Purpose:** Create a complete, implementation-ready feature story.

**Entry Point:** `implementation-story.md`

**What It Does:**
1. **Branch Check** - Ensures you're not on master/main
2. **Discovery** - Problem, affected users, magic moment
3. **Success & Scope** - Measurable metrics, in/out scope, risks
4. **Technical Exploration** - Launches 3 parallel agents for deep codebase analysis
5. **Deep-Dive** - Exact file paths, line numbers, before/after code
6. **Acceptance Criteria** - Given/When/Then format with test approaches
7. **Implementation Tasks** - Tasks mapped to ACs with code details
8. **Testing & Validation** - Quality checklist enforcement

**Output:** `docs/stories/{slug}.md` - Complete implementation-ready story

**Duration:** 30-60 minutes

**Special Features:**
- Optional advanced elicitation at Steps 4 & 6 (invoke-task adv-elicit.xml)
- Parallel agent execution for comprehensive analysis
- Living document (saves after each section)

---

### 2. quick-story

**Purpose:** Fast, compact feature planning for medium-sized features (~50% faster than implementation-story).

**Entry Point:** `quick-story.md`

**What It Does:**
1. **Quick Init** - Branch check
2. **Quick Discovery** - Problem & scope combined (one step)
3. **Technical Scan** - Single exploration agent (focused analysis)
4. **AC & Tasks** - Acceptance criteria and tasks combined
5. **Quick Validation** - Essential quality check

**Output:** `docs/stories/{slug}.md` - Compact implementation-ready story

**Duration:** 15-30 minutes

**Special Features:**
- 4 steps instead of 8 (combined steps)
- 1 exploration agent instead of 3
- Compact template (~15 fields vs ~30)
- Optimized for #yolo mode

**When to Use:**
- Feature is medium-sized (3-8 files)
- Requirements are relatively clear
- Time is a constraint
- Fast iteration needed

---

### 3. bug-fix

**Purpose:** Create a minimal bug-fix story (IST vs. SOLL).

**Entry Point:** `bug-fix.md`

**What It Does:**
1. **Branch Check** - Create bug/* branch
2. **Bug Understanding** - IST (current) vs. SOLL (expected)
3. **Root Cause Analysis** - Find affected files and cause
4. **Fix Documentation** - Exact changes needed
5. **Verification** - Test steps

**Output:** `docs/stories/bug-{slug}.md`

**Duration:** 10-20 minutes

---

## Workflow Comparison

| Feature | bug-fix | quick-story | implementation-story |
|---------|---------|-------------|---------------------|
| **Duration** | 10-20 min | 15-30 min | 30-60 min |
| **Steps** | 3 phases | 4 steps | 8 steps |
| **Agents** | None | 1 (Explore) | 3 (parallel) |
| **Template Fields** | ~10 | ~15 | ~30 |
| **Quality Gates** | 3 | 1 | 5 |
| **Use Case** | Bug fixes | Medium features | Large features |
| **Complexity** | Simple | Medium | Complex |
| **Detail Level** | Minimal | Compact | Comprehensive |

**Recommendation:**
- Use **bug-fix** for: Bug fixes, small corrections
- Use **quick-story** for: New features (3-8 files), clear requirements
- Use **implementation-story** for: Large features (10+ files), architectural decisions, complex integrations

---

## Usage

### Running implementation-story

```bash
# In Claude Code:
/implementation-story
```

The workflow will:
1. Load `workflow.xml` (the engine)
2. Load `implementation-story/workflow.yaml` (the config)
3. Follow `implementation-story/instructions.md` (the steps)
4. Use `implementation-story/story-template.md` (the output format)
5. Validate with `implementation-story/checklist.md`

### Running quick-story

```bash
# In Claude Code:
/quick-story
```

The workflow will:
1. Load `workflow.xml` (the engine)
2. Load `quick-story/workflow.yaml` (the config)
3. Follow `quick-story/instructions.md` (the steps)
4. Use `quick-story/story-template.md` (the output format)
5. Validate with `quick-story/checklist.md`

### Running bug-fix

```bash
# In Claude Code:
/bug-fix
```

Standalone workflow - no XML engine needed.

---

## Variable Resolution

The engine resolves these variables automatically:

| Variable | Resolves To | Example |
|----------|-------------|---------|
| `{project-root}` | Your project's root directory | `/home/user/myproject` |
| `{workflow-engine-path}` | Where workflow.xml is located | `.claude/claude-workflows` |
| `{workflow-dir}` | The specific workflow folder | `implementation-story/` |
| `{installed_path}` | Same as workflow-dir | `implementation-story/` |
| `{{story_slug}}` | Runtime-captured slug | `dark-mode-toggle` |
| `{{date}}` | System-generated date | `2025-12-08` |

---

## Advanced Elicitation

The `adv-elicit.xml` task provides optional content enhancement during workflow execution.

**When Invoked:**
- Step 4 (after technical deep-dive)
- Step 6 (after implementation tasks)

**How It Works:**
1. Loads `adv-elicit-methods.csv` (30+ elicitation methods)
2. Smart-selects 5 methods based on context
3. Presents options: 1-5 (apply method), r (reshuffle), x (proceed)
4. Iteratively enhances content
5. Returns enhanced content to workflow

**Methods Include:**
- Core: Pre-mortem, Devil's Advocate, Edge Case Explorer
- Structural: Dependency Mapper, Interface Designer
- Risk: Failure Mode Analysis, Security Threat Modeling
- Creative: Analogical Thinking, Constraint Removal
- ... and 20+ more

---

## Customization

### Modify Workflow Steps

Edit `implementation-story/instructions.md` to change workflow behavior.

### Modify Output Format

Edit `implementation-story/story-template.md` to change output structure.

### Modify Quality Gates

Edit `implementation-story/checklist.md` to adjust validation criteria.

### Add New Elicitation Methods

Edit `adv-elicit-methods.csv`:
```csv
category,method_name,description,output_pattern
core,Your Method,"Rich description here","input → analysis → output"
```

---

## Engine Behavior

### Normal Mode
- User confirms at every quality gate
- Optional steps prompt for inclusion
- Full interaction at decision points

### #yolo Mode
- Skips optional sections automatically
- Minimizes prompts
- Fast execution for experienced users

To activate: Include `#yolo` in your initial request

---

## Requirements

- Claude Code CLI
- Git repository initialized
- `docs/stories/` folder (created automatically if missing)
- Node.js/npm (if using Task tool for agent spawning)

---

## Troubleshooting

### "Cannot find workflow.xml"
- Ensure `{workflow-engine-path}` resolves correctly
- Check that workflow.xml is in the same folder as implementation-story.md

### "Variable not resolved"
- Runtime variables are captured during workflow
- If missing, workflow will ask user for input

### "adv-elicit.xml not found"
- Ensure adv-elicit.xml and adv-elicit-methods.csv are in the same folder as workflow.xml

### "Template not found"
- Ensure all files in `implementation-story/` folder are present
- Check workflow.yaml paths

---

## Version & Source

**Created:** 2025-12-08
**Source:** Scribomate Project (BMad Module, adapted for standalone use)
**Engine Version:** BMad 6.0.0-alpha.7 (XML/YAML execution engine)
**License:** Free to use and modify

---

