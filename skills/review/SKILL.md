---
name: review
description: Use for independent review of nontrivial implementation proposals before approval and nontrivial implementations before final evidence; also use for explicit code, plan, feedback, pull-request, issue, or deep code-quality, structural, or simplification review
---

# Independent Review

The author is the one least able to see what its own work misses. So every review runs in fresh reviewers that start without your conversation and find the facts themselves

## Timing

You MUST:
- finish the reviews and handle their findings before you ask for approval or report the work done

You MUST NOT:
- make a status the user asks for wait for a review

## Reviewers

You MUST:
- spawn one `reviewer` for each core angle, every time: Alignment, Correctness, Coding rules, and Design
- add a specialist for every risk the change touches, such as security, data and migrations, concurrency, performance, operations and deploys, or tests and proof
    - when unsure whether one applies, add it
    - give each specialist its own fresh reviewer and one surface

You MUST NOT:
- let a specialist replace a core angle

When the user asks for a deep quality, structural, or simplification review, you MUST review everything the user named, not only a diff

## Briefing

A reviewer's brief holds:
  - the change: the diff, files, commit, or proposal file
  - its angle, or its specialist surface
  - your requirement IDs, each with where in the session it comes from
  - raw material only you have, such as an unsaved diff or unedited command output
  - your claims
  - other session files, when an earlier decision matters

When the user names a branch, tag, commit, or range, you MUST:
- resolve each ref once to a commit ID, plus the merge base when the comparison needs one, without fetching or changing Git
- give every reviewer the same base, head, included commits, and diff
- if a ref doesn't resolve or the diff is unexpectedly empty, report that instead of reviewing

## After the reviews

You MUST:
- get each fix that changes behavior a fresh review from the angles it touches. When unsure, rerun all four
- stop when the reviews pass, when only user choices and rejected suggestions remain, or when a blocker or inconclusive result needs the user. Then report what is missing rather than rerunning without new information
- report blockers first, each with why it's in scope. Mark small items as small

## Feedback from others

You MUST check each point of someone else's review against the current source, and push back with evidence when it's wrong or out of scope
