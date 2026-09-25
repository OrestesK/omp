---
name: github-pr-comments
description: Draft, refine, place, or post actionable GitHub pull-request review comments from validated findings
---

# GitHub PR Comments

Turn validated review findings into concise, useful GitHub comments.

This skill owns comment selection, wording, placement, severity, review event, approval, and posting verification. It does not perform the underlying code review.

## Preflight

Before drafting comments:

- Identify the repository, pull request, and current head revision
- Confirm that each finding and its evidence apply to the current head
- Read existing comments to avoid duplicate or noisy feedback
- If the head changed after review, return affected findings for revalidation
- Do not silently weaken a finding when its original evidence is unavailable

## Finding Filter

Keep only findings that pass every applicable gate:

- **Evidence:** direct source, diff, test, documentation, or check evidence supports the claim
- **Impact:** the comment explains why the issue matters
- **Actionability:** the author can fix it, answer a focused question, or intentionally decline it
- **Scope:** the issue belongs to this pull request
- **Signal:** the value exceeds the notification and review-noise cost
- **No speculation:** the claim does not depend on an invented or unrealistic scenario
- **Assumptions:** every material assumption is explicit

When a claim depends on an uncertain assumption, ask a focused question instead of stating the assumption as fact. Drop it when the assumption is weak, unverifiable, or not worth asking about.

Drop or downgrade:

- Linter or formatting issues automation should catch
- Personal taste without an established repository pattern
- Cosmetic or minor nits without concrete benefit
- Large refactors not required for the current pull request
- Generic architecture essays
- Findings unrelated to changed behavior
- Claims that cannot be verified
- Several comments describing the same root cause

Prioritize correctness, simplification, architecture, ownership, deduplication, typing boundaries, and reuse of established patterns.

## Choose Placement

Use an inline comment for:

- A concrete issue on a changed line
- A local simplification at one location
- A type or API problem visible at a specific declaration
- A test or documentation issue anchored to a changed line

Use the review body or a general pull-request comment for:

- Cross-cutting architecture feedback
- Findings spanning multiple files
- Scope or product questions
- A valid finding with no commentable changed-line anchor
- A concise review summary

Do not force an inline comment onto an unrelated or invalid anchor.

## Write the Comment

Keep each comment concise but complete.

For a nontrivial finding, use the parts that add information:

```markdown
<focused statement or question>

What’s wrong:
- <specific issue>

Evidence:
- <file:line or direct evidence>

Impact:
- <observable consequence or maintenance cost>

Assumption:
- <only when the claim depends on one>

Suggested fix:
- <smallest coherent direction>
```

For an assumption-dependent or product decision, replace `Suggested fix` with:

```markdown
Question:
- Assuming <specific assumption>, should we <recommended direction>?
```

Tiny comments may use one short paragraph. Do not force every heading into every comment.

## Language

Use casual, direct, code-focused language.

Prefer:

- “Can we move this into the existing helper?”
- “This duplicates the ownership already in …”
- “Assuming this path must support X, should we …?”
- “This changes Y because …”

Avoid:

- Praise padding or performative politeness
- Blame language
- Vague statements such as “this is weird” or “clean this up”
- Calling an optional simplification broken
- Stating an assumption as fact
- Speculative future scenarios without a direct current risk
- Long essays when one concrete comment is sufficient

## Severity and Review Event

Label findings by intent when a label improves clarity:

- `must-fix` — a verified problem requiring a change before merge
- `suggestion` — an optional improvement with concrete benefit
- `question` — an answer is needed, not necessarily a code change
- `nit` — a small optional improvement worth the notification cost

Default to a normal comment review.

Use a blocking review only when:

- The user explicitly requests it
- At least one verified must-fix finding exists

Approve only when the user explicitly requests approval and readiness has been verified.

Labels communicate intent. They do not grant posting authority.

## Drafting Workflow

1. List validated candidate findings
2. Express each as a one-line falsifiable claim
3. Confirm that its evidence still applies to the current head
4. List any assumptions
5. Classify it as:
   - inline comment
   - general comment
   - assumption-dependent question
   - drop
6. Merge duplicates that share one root cause
7. Rewrite retained findings in concise, direct language
8. Present the exact proposed comments and placements before posting unless the user already requested a specific prepared set

## Apply an Approved Review

Immediately before posting:

- Confirm that the pull-request head still matches the reviewed head
- Confirm every inline anchor is a changed, commentable line
- Move a valid finding without a valid anchor to the review body
- Apply only the approved comments, placements, and review event
- Submit related comments as one review when possible
- Stop if the head changed, an anchor is stale, or the result is ambiguous

After posting:

- Read back the resulting review
- Confirm the canonical URL
- Confirm the event type
- Confirm the number and placement of submitted comments
- Report any finding moved from inline placement to the review body

Do not blindly retry or post partial duplicates after an ambiguous result.
