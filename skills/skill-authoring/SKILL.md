---
name: skill-authoring
description: Write or revise reusable skill instructions. Use when defining a skill's activation boundary, workflow, constraints, examples, or instructional prose. Do not use for runtime configuration or placement
---

# Skill Authoring

Write the smallest instruction set that reliably changes behavior for a real task.

## Establish Need and Ownership

Before drafting:

- Identify the exact behavior the skill will own
- Identify a current task or consumer that needs that behavior
- Inspect existing skills and higher-level instructions for overlap
- Update an existing owner when it can absorb the behavior cleanly
- Keep each rule with one owner instead of copying it across skills
- Do not repeat global authorization, tool-selection, verification, or communication policy
- Do not create a skill for knowledge the model already applies reliably without specialized instruction

A skill should teach a domain procedure or judgment. It should not become a runtime manual unless the runtime is its subject.

## Define the Activation Contract

Treat the description as a routing contract, not a summary of the full instructions.

Before writing it, identify:

- Direct user requests that should activate the skill
- Common synonyms and paraphrases
- Adjacent requests owned elsewhere
- Near misses that should not activate it
- Any handoff boundary that prevents a likely collision

Write the description in concrete user language. State:

1. What capability the skill provides
2. When to use it
3. A narrow exclusion only when it prevents plausible misrouting

Prefer:

```yaml
description: Extract text and tables from PDF files. Use when reading, converting, or inspecting PDF documents
```

Avoid:

- Vague claims such as “helps with development”
- Inventories of every possible feature
- Internal taxonomy users would not say
- Trigger phrases unrelated to the actual behavior
- Universal activation for a specialist workflow
- Negative-only descriptions
- Tool, file, or runtime references the skill does not intrinsically require

## Write the Instructions

- Start with the shortest correct working model of the skill
- State the scope boundary before detailed procedure when misuse is plausible
- Write actions as direct imperative instructions
- Put the normal execution path in the order it should happen
- State preconditions before the actions they constrain
- Keep exceptions and uncertainty beside the affected rule
- Make decision points operational:
  - identify the evidence that selects each branch
  - state what to do for each branch
- State stopping conditions when continuing would create incorrect or unauthorized work
- Preserve domain terminology when precision depends on it
- Avoid prescribing a specific tool unless that tool is intrinsic to the capability
- Avoid implementation details that do not change the model’s decision or output
- Explain rationale only when it prevents misuse or changes a decision
- Use examples only for genuinely ambiguous behavior, formats, boundaries, or edge cases

## Organize the Prose

- Use sections and subsections for distinct topics or stages
- Give each action or rule its own bullet
- Nest conditions, exceptions, and required detail below the rule they modify
- Use numbered lists only when order matters
- Keep intent and rationale in short paragraphs
- Do not restate the description in the body
- Remove decorative introductions, generic advice, repeated conclusions, and ceremonial checklists
- Prefer one precise rule over several overlapping approximations

## Make the Procedure Executable

For each material instruction, make clear:

- What input or evidence it uses
- What decision or action follows
- What observable output or state it produces
- Which boundary, failure, or uncertainty changes the path

Trust owned invariants. Do not add fallback behavior, coercion, retries, sanitization, or error wrapping unless the skill’s approved contract requires them.

## Review the Content

Before finalizing:

- Confirm every instruction changes behavior for a reachable task
- Confirm no rule duplicates or conflicts with another active owner
- Confirm the workflow covers its normal path, material branches, and stopping conditions
- Confirm examples defend a real ambiguity instead of decorating the prose
- Confirm references to tools or runtimes are intrinsic and currently valid
- Remove wording that only describes package structure or implementation mechanics

Check the activation contract with:

- One direct trigger
- One synonym or paraphrase
- One near miss
- One negative control
- One fresh-context request

Structural discovery proves only that a skill is visible. It does not prove that the description routes correctly or that the instructions produce the intended behavior.
