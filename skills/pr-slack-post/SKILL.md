---
name: pr-slack-post
description: Draft a short Slack message that posts a pull request for review. Use when asked to write, craft, or suggest a Slack message or post for one or more PRs
---

# PR Slack Post

The message says who should review and what the PR does. The GitHub link preview already shows the PR description, so the message stays short and adds nothing the preview covers.

## Before Drafting

- Read the PR title, description, and changes well enough to say in plain words what it does
- Use the reviewer the user named
  - If the user named none, write `@reviewer` for the user to fill in. Do not guess a reviewer
- If the PR has no live-test evidence, tell the user beside the draft
  - Do not put test status in the message

## Format

```
@reviewer <what it does>
• <PR URL>
• <how it works>
```

- First line: the reviewer mention, then what the PR does
  - Use plain lowercase words and no final period
  - Keep it to one short line
  - Do not add a greeting, title, bold text, emoji, or "please review"
- Second line: the raw PR URL as a `•` bullet
- Add up to 3 `•` bullets on how it works only when the first line does not make the change clear
  - Write them in words a teammate understands without reading the code
  - Do not include CI status, test counts, commit hashes, file lists, or internal names the reader would not know
- Write casually and directly, like a teammate, not like a report

Example:

```
@Jarett retry benchmark claims when postgres drops the connection instead of failing the run
• https://github.com/vals-ai/Valkyrie/pull/871
• Claims retry a few times on short DB errors
• Runs only fail if the DB stays down past the claim deadline
```

## Variants

- Trivial change that only needs an approval: start with `stamp, ` and omit the how-it-works bullets
  - `stamp, bump model-proxy default timeout to 10 min for grok` then `• <PR URL>`
- Several PRs on one topic: write one message
  - First line: `<topic>: @reviewer`
  - One bullet per PR: `• <PR URL> - <short description>`
- Independent PRs: write one message per PR
- Prerequisite PR: suggest it as a thread reply under the main post
  - `also, quick prereq for this pr:` then `• <PR URL>`

## Finish

- Give the user the draft in a code block so it copies cleanly
- Post it only when the user asks you to post it
