---
name: pi-config
description: Write and maintain clear, consistent Oh My Pi configuration. Use when changing OMP instructions, agents, skills, prompts, policies, resource ownership, or duplicated rules
---

# Pi Config

Use this skill to keep OMP configuration owned, consistent, centralized, and clearly written. Writing quality is its primary concern.

## 1. Know the owner

Before proposing or changing configuration:

- Identify the active canonical owner of the behavior
- Resolve applicable user configuration and project-local `.agent/` or `.agents/` resources
- Check discovery order, overrides, fallbacks, and same-name collisions
- Verify external behavior against the installed OMP version and current primary documentation
- Treat historical files and session records as evidence, not as active configuration

Do not assume that a file, package, or builtin definition is active because it exists.

## 2. Make a consistent change

- Account for every affected owner, override, fallback, prompt, skill, agent, extension, package, and check
- State the intended behavior and every active surface that will change
- For material prompt or policy prose changes, show complete exact before-and-after blocks in coherent sections before implementation
- Make conflicting active surfaces agree in the same change
- Adapt migrated resources to current OMP paths, fields, tools, and discovery behavior
- Preserve unrelated files and version-control state
- Verify the affected surface by parsing configuration, validating frontmatter, confirming discovery and precedence, and exercising the changed runtime path when possible
- State the exact boundary when runtime verification is unavailable

## 3. Centralize instead of duplicating

- Keep each executable rule in one canonical owner instead of repeating it across instructions, skills, agents, prompts, and fallbacks
- When consolidating rules, confirm that the retained owner covers every obligation, actor, condition, and exception
  - Do not require identical wording to establish redundancy
  - Distinguish preserved written policy from untested model adherence
- Keep project-specific behavior project-local
- Remove superseded active definitions after every caller and reference has moved to the canonical owner

## 4. Write clear configuration prose

Treat writing, structure, and style as the primary output of configuration work. Apply these rules to instruction files, rules, agent definitions, skills, and prompts.

### Structure

- Use Markdown sections and subsections for distinct topics and stages
- Give each action or rule its own bullet
  - Nest its conditions, exceptions, and required details below it
- Use numbered lists only when order matters
- Keep intent and rationale in short paragraphs

### Punctuation

- Keep periods between sentences in the same paragraph or list item
- Omit a period only when it ends that prose paragraph or list item
- Omit prose semicolons
- Do not split normal sentences only to satisfy punctuation style
- End a list lead-in with `:` and put the first item on the next line with no blank line
