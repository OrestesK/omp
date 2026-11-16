---
name: editing-omp-config
description: Plan, write, and maintain clear, consistent OMP configuration
---

# Editing OMP Config

## 1. Know the owner

Before proposing or changing configuration, you MUST:
- Identify the active canonical owner of the behavior
- Resolve applicable user configuration and project-local `.agent/` or `.agents/` resources
- Check discovery order, overrides, fallbacks, and same-name collisions
- Verify external behavior against the installed OMP version and current primary documentation
- Treat historical files and session records as evidence, not as active configuration

You MUST NOT:
- Assume that a file, package, or builtin definition is active because it exists

## 2. Make a consistent change

You MUST:
- Account for every affected owner, override, fallback, prompt, skill, agent, extension, package, and check
- State the intended behavior and every active surface that will change
- Before implementing material prompt or policy prose changes, present an exact contextual diff against the known active baseline, with enough surrounding context to review each affected change
    - For the first artifact and later feedback, follow [Draft review and feedback](../../rules/communication.md#draft-review-and-feedback)
- Make conflicting active surfaces agree in the same change
- Adapt migrated resources to current OMP paths, fields, tools, and discovery behavior
- Preserve unrelated files and version-control state
- Run the structural checks applicable to the changed resource: configuration parsing, frontmatter validation, discovery, and precedence
- Follow “Verify configuration changes” for behavioral verification
- State the exact boundary when runtime verification is unavailable

## 3. Centralize instead of duplicating

You MUST:
- Keep each executable rule in one canonical owner instead of repeating it across instructions, skills, agents, prompts, and fallbacks
- When consolidating rules, confirm that the retained owner covers every obligation, actor, condition, and exception
    - Do not require identical wording to establish redundancy
    - Distinguish preserved written policy from untested model adherence
- Keep project-specific behavior project-local
- Remove superseded active definitions after every caller and reference has moved to the canonical owner

## 4. Write clear configuration prose

You MUST treat writing, structure, and style as the primary output of configuration work. Apply the rules below to instruction files, rules, agent definitions, skills, and prompts.

### Structure

You MUST:
- Use Markdown sections and subsections for distinct topics and stages
- Give each action or rule its own bullet
    - Nest its conditions, exceptions, and required details below it
- Use numbered lists only when order matters
- Keep intent and rationale in short paragraphs

### Punctuation

You MUST:
- Keep periods between sentences in the same paragraph or list item
- Omit a period only when it ends that prose paragraph or list item
- End a list lead-in with `:` and put the first item on the next line with no blank line

You MUST NOT:
- Use prose semicolons
- Split normal sentences only to satisfy punctuation style

### Write actionable instructions

You MUST:
- Use `MUST` and `MUST NOT` for actual obligations without weakening their conditions
- Use simple words and concrete actions without generalizing away required details
- Add instructions for behavior the model needs to learn, not generic knowledge or advice a capable model already applies reliably
- Ground new rules in confirmed user requirements or preferences
    - Use evidence to support a proposal, not to authorize a new rule
- Preserve information when rewriting instructions:
    - Required actions and who performs them
    - Triggers, conditions, exceptions, and scope
    - Specific resources, interfaces, and identifiers
    - Ordering, approval gates, verification, and stopping conditions
- Make each decision explicit: the evidence it uses, the action it selects, the observable result, and its stopping conditions
- Use examples only when they clarify a real ambiguity

### When editing skills

You MUST:
- Before creating a skill, identify a current task or consumer that needs its specialized procedure or judgment
- Treat the description as instructions for when to use the skill, not a summary of the body
- State the capability, when to use it, and exclusions only where they prevent a plausible collision

You SHOULD NOT:
- Use feature inventories, unrelated triggers, or repetition of the description in the body

## Verify configuration changes

You MUST:
- Always spawn a fresh-context subagent when verifying a configuration change
- Confirm that the test agent receives the changed configuration through normal loading before judging its behavior
    - A fresh conversation may still inherit cached configuration
    - Establish this outside the test task, using a refreshed or newly loaded session when needed
- Give the subagent a realistic task, necessary facts and resources, and ordinary permission boundaries
- Keep the authoring conversation, expected result, and evaluation criteria out of its task context
- Do not tell it which skill or tool to use, which steps to follow, or how to demonstrate the desired behavior
- Inspect its actual actions, tool calls, and output against the intended behavior rather than relying on its self-report
- For skill activation changes, check a direct request, a paraphrase, a near miss, and a negative control in separate fresh contexts
- Report deviations and unexercised behavior
    - If the affected behavior is unavailable in the subagent context, verify the actual affected runtime separately and state that limit
- Repeat behavioral verification with a new context after revising the configuration

Structural checks prove parsing and discovery, not that the agent follows the instructions
