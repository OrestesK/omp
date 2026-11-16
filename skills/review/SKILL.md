---
name: review
description: Use for independent review of nontrivial implementation proposals before approval and nontrivial implementations before final evidence; also use for explicit code, plan, feedback, pull-request, issue, or deep code-quality, structural, or simplification review
---

# Independent Review

The author is the one least able to see what its own work misses. So every review runs in fresh reviewers that start without your conversation and find the facts themselves

For PR reviews, you MUST:
- Check whether each addition is needed for the requested change, not just whether it works
- Do not approve additions based on the PR's own claims. Verify their necessity independently—intentional, documented or tested is not enough

## Reviewers

You MUST:
- for nontrivial implementation proposals and nontrivial implementations, spawn one `reviewer` for each core angle: Alignment, Correctness, Coding rules, and Design
- for other reviews, select the applicable core angles and spawn one `reviewer` for each selected angle
- add a specialist for every risk the change touches, such as security, data and migrations, concurrency, performance, operations and deploys, or tests and proof
    - when unsure whether one applies, add it
    - give each specialist its own fresh reviewer and one surface

You MUST NOT:
- let a specialist replace a core angle

When the user asks for a deep quality, structural, or simplification review, you MUST review everything the user named, not only a diff

## Briefing

A reviewer's brief holds only:
  - the review target: the diff, files, commit, or proposal file
  - its angle, or its specialist surface
  - the current user-session file path, not an intermediate agent transcript, and relevant earlier session paths
  - other source locations and requirement IDs, each ID with its source location, as navigation rather than an authoritative or exhaustive account of intent
  - raw material the reviewer cannot otherwise access, such as an unsaved diff or unedited command output
  - specific claims about the target, explicitly labeled for independent verification

You MUST:
- in the user-facing main agent, read `os.environ["PI_SESSION_FILE"]` through Python Eval and include that path in `task.context`
- pass the supplied user-session source pointer unchanged through delegated review work, not replace it with a subagent's own session path
- obtain and pass the new path when the user conversation continues in another file

Assigning a target or angle does not authorize excluding user decisions that govern that target

When the user names a branch, tag, commit, or range, you MUST:
- resolve each ref once to a commit ID, plus the merge base when the comparison needs one, without fetching or changing Git
- give every reviewer the same base, head, included commits, and diff
- if a ref doesn't resolve or the diff is unexpectedly empty, report that instead of reviewing

## After the reviews

You MUST:
- before accepting `PASS` from a reviewer assigned design, code quality, or simplification, check the reported scope coverage and alternative comparisons and request any missing review work
- get each fix that changes behavior a fresh review from the angles it touches. When unsure, rerun all four
- stop when the reviews pass, when only user choices and rejected suggestions remain, or when a blocker or inconclusive result needs the user. Then report what is missing rather than rerunning without new information
- report blockers first, each with why it's in scope. Mark small items as small

## Feedback from others

You MUST check each point of someone else's review against the current source, and push back with evidence when it's wrong or out of scope
