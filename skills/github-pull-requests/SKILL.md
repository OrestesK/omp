---
name: github-pull-requests
description: Use to prepare, review, update, or merge GitHub pull requests, respond to PR feedback, or monitor deployments triggered by a PR merge
---

# GitHub Pull Requests

## Keep PR evidence current

For a readiness claim or review that depends on current PR content:
1. Select the PR and record its number, URL, state, head name/OID, and base name/OID
2. Use that PR number for every later metadata, diff, check, and review query. Collect evidence for the recorded PR state
3. Immediately before the final claim or an authorized claim-bearing post, fetch the same identity fields again with that PR number
4. If the state, head name/OID, or base name/OID changed, do not claim or post. Reassess the PR, discard evidence that depended on its old content, collect the needed evidence again, and repeat this check
5. Report the final identity as `PR <number> <url>; head <name>@<OID>; base <name>@<OID>`

This check confirms freshness:
- it does not lock the PR. Use it only when the conclusion depends on PR content, not for metadata-only inspection or non-PR reviews

## Publish Authorized PRs

- When an approved task has several independently reviewable pieces, propose a single PR, separate PRs, or a stack, recommend a structure, and let the user choose before creating or restructuring the PRs
    - Reassess the structure when new reviewable slices become apparent after publication
    - Recommend stacked PRs when clear dependent slices would be easier to review
    - Stacked PRs are recommendations, not blockers
- Push the coherent changes and create the PR before running any of your own checks on those changes, including tests, smoke checks, static checks, or independent review
    - Keep an existing PR current with approved task changes, including updates that need no checks
    - Push each update before checking it
    - Use non-draft by default
    - If a concrete reason makes it unready for review, explain the tradeoff and ask before using draft
- Give the user the PR URL immediately after creation, before further work

## Observe Your PR in the Background

- Delegate CI and incoming-feedback observation to a background agent while the main agent continues independent work
    - The observer reports CI failures and new feedback waves to the main agent
    - The main agent delegates an obvious in-scope fix or asks the user when the resolution requires a decision
- During the active session, keep watching for incoming feedback after human-review handoff
    - An initially empty comment list means no feedback yet, not that AI review finished
    - The main agent handles incoming waves under Respond to PR Feedback
- Pending CI does not block continued work or human-review handoff

## Prepare Your PR for Human Review

Live tests and supporting artifacts are recommendations, not blockers. If the author wants to request review without them, explain what is missing and continue

1. Inspect the current PR, diff, intent, repository rules, and available check evidence
2. Launch the required independent review in the background unless a still-current review already covers the change
    - Repeat review when relevant changes invalidate it, not merely because handoff is next
    - Pending review does not block publication, continued work, or human-review handoff
    - Complete the applicable independent review before merging
3. Identify and suggest a representative live test when one would add useful evidence
   - Draft how its result would be reported in the PR description
   - If no useful live test is possible, always say why
   - Keep PR checks and static checks separate from live-test evidence
4. Decide from the change whether to suggest:
   - a diagram for an architectural change
   - a design document for a large change
5. After meaningful changes, refresh the affected evidence and suggested tests, following the publication and review order above
6. Immediately before declaring the PR ready for the user's review, fetch all feedback currently posted and account for it under Respond to PR Feedback
    - Include automated-review feedback already posted
    - Do not wait for future feedback before handing the PR back

### Progress and handoff

- State what is complete, what is pending, and any known unresolved concerns when handing the PR back

## Review Someone Else's PR

1. Read the description, full diff, checks, comments, relevant code, and repository rules
2. Explain the change to the user in plain language
3. Run a fresh independent review of the change and synthesize the result
4. Turn validated findings into proposed outgoing comments
5. Show every proposed comment to the user
6. Post only comments the user approves

## Respond to PR Feedback

- Read all inline threads, review bodies, general PR comments, and existing replies, including resolved or outdated threads and automated feedback
- Evaluate each concern against the current code and available evidence
    - Reuse a prior assessment while the relevant code, comment, and evidence remain unchanged
    - Distinguish implemented and verified, solved differently, declined with a reason, and still open
    - A posted reply is not evidence that the concern was resolved
- Delegate obvious fixes within the approved scope in the background
- Collect matters needing the user's judgment, including design changes and ownership questions
    - First show the full decision list with a short description and proposed approach for each item
    - Then discuss the decisions one at a time while independent fixes continue
- Reply to every inline PR comment, and to top-level comments that need a response
    - Explain what changed, what was done differently and why, or why no change was made
    - Bring unresolved decisions to the user rather than posting a non-answer
- Recheck the original concern after a fix
- Show every proposed reply to the user
- Post only replies the user approves
- The author or their agent may resolve AI-reviewer comments after addressing them
- Only the human reviewer may resolve comments left by that reviewer

## Merge Your PR

- Before recommending or performing an authorized merge, assess current CI against repository requirements
    - If CI fails, quickly compare the failure with CI on previously merged PRs
    - Treat the same failure on previously merged PRs as nonblocking for this PR, without bypassing repository protections

## After Your PR Merges

- After confirming the PR merged, follow any deployment automatically triggered by that merge read-only and report its observed outcome

## PR Description Format

### Timing and approval

- Prepare the description when creating a PR
- Refresh it at final completion or handoff of the PR work, not continuously as the work evolves
- Draft PR-description changes and update GitHub only with the user’s approval

### Body format

Use this format when drafting PR text or when the user explicitly asks to update a PR description/body:

```
## What changed
Concise summary. Key files/areas affected

## Why
Motivation, context, problem being solved

## How tested
Tests added/updated, manual checks, commands run
```

The format is flexible. You may add sections and use the format's sections in the repository's existing PR template

When the work context mentions a ticket or issue, attach it to the PR and include it in the description

For a PR with a large or mixed diff, add guidance that tells reviewers where to start and separates core behavior from generated, mechanical, or formatting-only changes:
- separate core behavior files from generated, mechanical, or formatting-only files
- say which files or areas reviewers should read first
- call out risky behavior changes, migration/order dependencies, rollout notes, and test coverage
- recommend splitting the PR instead of polishing the description when the diff is too large or mixed to review safely
