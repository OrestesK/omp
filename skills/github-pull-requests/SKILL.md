---
name: github-pull-requests
description: MUST be loaded when working in a GitHub repository, working on a GitHub pull request, or monitoring deployments triggered by a PR merge
---

# GitHub Pull Requests

## Keep PR evidence current

For a readiness claim or review that depends on current PR content:
1. Select the PR and record its number, URL, state, head name/OID, and base name/OID
2. Use that PR number for every later metadata, diff, check, and review query. Collect evidence for the recorded PR state
3. Immediately before the final claim or an authorized post that makes a claim, fetch the same identity fields again with that PR number
4. If the state, head name/OID, or base name/OID changed, do not claim or post. Reassess the PR, discard evidence that depended on its old content, collect the needed evidence again, and repeat this check
5. Report the final identity as `PR <number> <url>; head <name>@<OID>; base <name>@<OID>`

This check confirms freshness:
- it does not lock the PR. Use it only when the conclusion depends on PR content, not for metadata-only inspection or non-PR reviews

## Choose delivery mode

- Keep approved implementation work on local task branches and commits by default
- Enter the publication workflow below when the user requests a PR or approved implementation work targets an existing PR
    - Keep work local if the user explicitly requests it
    - Publish approved task changes automatically, without waiting for another push request

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

Human-review handoff may proceed while required live verification is pending. Disclose its status when handing the PR back

Supporting artifacts remain recommendations, not handoff blockers. If the author requests review without them, explain what is missing and continue

### Handoff transition

1. Inspect the current PR, diff, intent, repository rules, and available check evidence
2. Launch the required independent review in the background unless a still-current review already covers the change
    - Repeat review when relevant changes invalidate it, not merely because handoff is next
    - Pending review does not block publication, continued work, or human-review handoff
    - Complete the applicable independent review before merging
3. Before final handoff, address these independent items:
    - Check the status of the live verification required by the coding rules
        - Report its result or pending status in the PR description
        - If verification cannot be completed, state why and leave it pending
        - Keep PR checks and static checks separate from live-test evidence
    - Decide from the change whether to suggest:
        - a diagram for an architectural change
        - a design document for a large change
4. Immediately before declaring the PR ready for the user's review, fetch all feedback currently posted and account for it under Respond to PR Feedback
    - Include automated-review feedback already posted
    - Do not wait for future feedback before handing the PR back

### Ongoing evidence refresh

- After meaningful changes, refresh the affected evidence and live-verification status, following the publication and review order above

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
- If the user has not requested replies or approved a response plan, present the concerns, proposed responses, supporting reasons, and decisions needed, then ask for approval to post
- Post authorized replies without a separate wording-approval step
- The author or their agent may resolve AI-reviewer comments after addressing them
- Only the human reviewer may resolve comments left by that reviewer

## Merge Your PR

- Before recommending or performing an otherwise-authorized merge, require the live verification specified in the coding rules to pass
    - The user may explicitly waive this live-verification gate
- Before recommending or performing an authorized merge, assess current CI against repository requirements
    - If CI fails, quickly compare the failure with CI on previously merged PRs
    - Treat the same failure on previously merged PRs as nonblocking for this PR, without bypassing repository protections

## After Your PR Merges

- After confirming the PR merged, follow any deployment automatically triggered by that merge read-only and report its observed outcome

## PR Description Format

### Timing

- Prepare the description when creating a PR
- Refresh it at final completion or handoff of the PR work, not continuously as the work evolves

### Content

- MUST use this scaffold

```markdown
<One sentence stating what changed>

- <Changed behavior>
- <Another changed behavior, if applicable>

## Rollout
- <Required deployment or migration step>

## Completed live verification
<Shared setup and run conditions, once>
- **<Behavior>**
    - <Action> → <observed outcome>
    - <Distinct action> → <observed outcome>
    - <Relevant limit>

## Not verified
- <Unfinished check and reason or consequence>

## Other checks
<One-line completed non-live check status>
```

- MUST explain the problem, intended outcome, scope, and mechanism through the changed-behavior bullets
- MUST explain consequential choices against credible alternatives, constraints, and accepted tradeoffs beside the affected behavior
- MUST state material guarantees, risks, and operational effects that this PR adds, removes, or changes
- For consequential edge and failure behavior affected by this PR:
    - MUST distinguish verified, untested, and intentionally excluded behavior
    - MUST explain those exclusions
- MUST include unchanged context only when omitting it would misstate a changed boundary or hide a rollout dependency
- Before finalizing, MUST remove all other unchanged-only clauses and bullets, including preserved facts attached to real changes and unrelated non-goals

```diff
- Cache successful responses; timeouts and retries remain unchanged
+ Cache successful responses
```

- MUST include required rollout actions, dependencies, and risks when applicable
- MUST put behavior-specific conditions and limits beside the affected live outcome
- MUST NOT substitute a run summary, test selector, commit hash, or count for observed behavior
- MUST put checks stopped before execution under Not verified, not Other checks
- MUST NOT put passed checks under Not verified
- MUST exclude historical non-live test and CI narratives, even when collapsed
- MUST include a one-line Other checks status when completed non-live checks are supplied
- When the work context mentions a ticket or issue:
    - MUST attach it to the PR
    - MUST include its link in the description
- For a large or mixed diff:
    - MUST identify where review should start
    - MUST separate core behavior from generated, mechanical, or formatting-only changes
    - MUST explain relevant test coverage briefly
    - MUST recommend splitting when the diff is too large or mixed to review safely

### Reading experience

- MUST map repository-required fields into the scaffold
- MUST omit irrelevant sections
- MUST group related content under one section, using subheadings for its parts
- MUST keep unresolved consequential decisions, blockers, and caveats visible
- MUST apply the [communication structure](../../rules/communication.md#structure-responses) to the PR body
- Where review guidance helps, MUST lead with the consequential behavior, decision, boundary, or risk
    - MUST link supporting files or functions beside that guidance where useful
- MUST use GitHub Markdown headings, emphasis, tables, links, and callouts where they improve the reading path
- MUST keep the main change diagram inline and apply the [focus](../diagram-design/SKILL.md#establish-meaning) and [comparison](../../rules/communication.md#comparisons) preferences across diagram formats
- MUST put reproduction commands, raw output, and lengthy supporting reasoning in `<details>` after their conclusions are visible
- MUST omit repeated explanations and chronological implementation diaries
- MUST put supporting review-response material and history in collapsed `<details>` at the bottom
    - At re-review handoff after substantive changes, MUST briefly summarize that cycle's meaningful changes, concerns addressed, and relevant verification
    - MUST keep one summary per cycle, newest first
