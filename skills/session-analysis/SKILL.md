---
name: session-analysis
description: Use to analyze past sessions, reconstruct what happened, identify errors and unresolved work, or extract user preferences and workflow friction that could improve agent configuration
---

# Session Analysis

Analyze available session history or a supplied transcript as a sequence of user exchanges. Produce a compact account of what happened, what failed, how the work recovered, and what remains unresolved.

Do not depend on a particular session directory, storage format, parser, or runtime.

## Establish the Scope

Determine:

- which session or session range matters
- whether the user wants a general overview or investigation of a specific problem
- which claims, errors, or outcomes need explanation

## Organize by User Exchange

Treat each user message and the work that follows it until the next user message as one exchange.

Create a table of contents with one entry for every user exchange in the analyzed session or selected range.

For each exchange, record:

- exchange number or timestamp
- user intent
- main action taken
- outcome: completed, failed, partial, redirected, or unclear
- notable error, retry, correction, or user feedback

Keep each entry short. Preserve separate entries even when several exchanges are repetitive so later findings have stable references.

## Extract Relevant Problems

Look for:

- explicit command, tool, API, or runtime errors
- failed or abandoned attempts
- repeated attempts and whether the retry changed anything material
- user-reported failures, complaints, corrections, or contradictions
- disagreement between expected and observed behavior
- work reported as complete without supporting evidence
- recovery that masked a symptom without resolving its cause
- unresolved questions, blocked work, and missing verification

Do not report expected negative checks, harmless intermediate failures, or fully superseded mistakes unless they explain the final outcome or reveal a recurring pattern.

## Describe Each Finding

For each relevant finding, state:

- **Where:** exchange number, timestamp, or another stable session reference
- **What happened:** the observable failure or complaint
- **Evidence:** the shortest transcript or result that supports it
- **Response:** what was tried next
- **Outcome:** resolved, unresolved, partially resolved, or unclear
- **Cause:** verified root cause, likely cause, or unknown

Separate direct evidence from inference. Do not invent missing events, motives, causes, or outcomes.

## Synthesize the Session

After extracting findings:

- identify repeated failure patterns
- distinguish the initiating problem from downstream symptoms
- note retries that repeated the same failing approach
- identify corrections that materially changed the result
- record where the user redirected or superseded earlier work
- state which conclusions remain uncertain because evidence is absent

Treat user-reported observations as evidence of what the user experienced. Do not dismiss them because the session lacks an independent reproduction.

## Review Configuration Candidates

When the user asks to improve agent configuration from session evidence:

- Include user messages, explicit answers to agent questions, and the surrounding actions
- Group corrections, repeated friction, and workflow or style preferences into reusable behavior candidates
- For each candidate:
  - cite the supporting exchange
  - distinguish an explicit preference from an inference or task-local choice
  - check later corrections, surrounding context, and contrary evidence
- Discuss candidates with the user as evidence becomes sufficient:
  - explain the proposed behavior, practical benefit, and uncertainty
  - recommend keeping, refining, or rejecting it
  - reuse decisions the user has already confirmed
- Compare each retained candidate with current configuration and classify it as already covered, conflicting, partially covered, or missing
- Prefer aligning an existing canonical rule over adding a rule for each incident
- Use `pi-config` for canonical placement, exact change proposals, approval, and verification

## Output

Always include:

1. **Summary** — the shortest accurate account of the session and its outcome
2. **Table of contents** — one compact entry for every user exchange in scope

Include when relevant:

3. **Failures and complaints** — evidence-backed findings in session order
4. **Patterns and causes** — recurring behavior and verified or likely causes
5. **Unresolved work** — remaining failures, missing proof, or unanswered questions

Reference exchanges instead of reproducing large transcript blocks. Quote only the minimum text needed as evidence.
