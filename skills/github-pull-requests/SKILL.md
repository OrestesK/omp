---
name: github-pull-requests
description: Use to prepare, review, update, or respond to feedback on GitHub pull requests
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

- After PR publication is authorized, open a coherent PR early and non-draft by default; if a concrete reason makes it unready for review, explain the tradeoff and ask before using draft
- Continue independent work while checks and reviews run
- Before claiming readiness, refresh the latest CI and automated-review evidence

## Prepare Your PR for Human Review

Live tests, supporting artifacts, and stacked PRs are recommendations, not blockers. If the author wants to request review without them, explain what is missing and continue

1. Inspect the current PR, diff, checks, comments, intent, and repository rules
2. Run a fresh review of the current PR change and any AI-reviewer feedback
3. Identify and suggest a representative live test when one would add useful evidence
   - Draft how its result would be reported in the PR description
   - If no useful live test is possible, always say why
   - Keep PR checks and static checks separate from live-test evidence
4. Decide from the change whether to suggest:
   - a diagram for an architectural change
   - a design document for a large change
   - stacked PRs when clear dependent slices would be easier to review
5. After meaningful changes, run a fresh review of the current PR, then refresh the suggested tests and checks

### Progress and handoff

- Continue until the code and evidence are current
- Complete independent agent work before optional human-handoff interactions

## Review Someone Else's PR

1. Read the description, full diff, checks, comments, relevant code, and repository rules
2. Explain the change to the user in plain language
3. Run a fresh independent review of the change and synthesize the result
4. Turn validated findings into proposed outgoing comments
5. Show every proposed comment to the user
6. Post only comments the user approves

## Respond to PR Feedback

- Read every comment and relevant code change
- Evaluate each comment against the current code and available evidence
- Reply to every inline PR comment, and to top-level (general PR) comments that need a response
- Recheck the original concern after a fix
- Show every proposed reply to the user
- Post only replies the user approves
- The author or their agent may resolve AI-reviewer comments after addressing them
- Only the human reviewer may resolve comments left by that reviewer

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
