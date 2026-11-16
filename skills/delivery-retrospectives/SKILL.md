---
name: delivery-retrospectives
description: Inventory completed PR-backed work from sessions, Slack, and GitHub. Use for shipped-work recaps and the Delivered Items retrospective-ticket workflow, not prospective issues or review-only summaries
---

# Delivery Retrospectives

Record delivered outcomes, not conversations or a list of PR titles. An inventory request does not itself request ticket publication

## Establish the delivery set

- Establish the person, date window, timezone, and requested sources
- Traverse all relevant pages of the requested sources, including teammate and bot threads
    - State access or coverage gaps before claiming the inventory is complete
- Determine window membership from dated messages, work, and PR merge or commit activity, not session modification or PR creation dates alone
- Use sessions and Slack threads for intent, attribution, and reported outcomes, including bot conversations within those sources
    - For Slack-only agent coverage, do not require access to the agent's private application
- Verify PR authorship, dates, and merge state in GitHub
    - Distinguish authored, delegated, and reviewed work
    - For a delivered-only inventory, exclude research, proposals, review-only activity, and unfinished or unmerged work
- Group related PRs into distinct implemented outcomes across repositories
    - Deduplicate the same work across sessions, Slack, and GitHub
    - Credit a shared PR to multiple outcomes only when it contains distinct delivered changes
    - Account for each included PR as delivery evidence or supporting evidence, not necessarily as its own ticket
- Preserve evidence limits: a merge is not deployment, package publication is not a hosted run, and configuration is not a verified integration

## Resolve ownership before classifying work

- Reuse an existing issue when it records the same original work, including an already completed issue
- Place a completed slice under an existing unfinished issue only when that issue covered the work and was assigned to the person for that work
    - Check assignment history against the work dates, not just current or historical assignment
    - A completed original issue does not own a new follow-up
    - Do not close the broader parent because one slice is finished
- Put outcomes without a qualifying existing owner under `Delivered Items` with the `ad hoc` label
    - Here, `ad hoc` identifies the recording arrangement, not whether the work was unplanned
    - Planned standalone work, direct requests, and completed-ticket follow-ups can belong here
- If the implementation repository has issues disabled, use an established planning repository rather than enabling issues

## Size and name the outcomes

Size the actual delivered scope, not how important or technical its title sounds:
- **S:** Bounded configuration, pin update, or repair to an existing path
- **M:** Substantive work in one component or a coherent feature
- **L:** Coordinated changes across components or runtimes

Selecting an existing provider API key is a small configuration change, not a new provider integration

For ad hoc outcomes, choose one work type in this order:
- **Request:** Implemented work directly requested by a teammate or customer
- **Review:** Implemented changes arising from PR review, not review-only activity
- **Maintenance:** Repairs and operational upkeep
- **Improvement:** Other new capabilities

The user's approval of a proposal is not evidence of a teammate request

- Use `[S · Request] Concrete change` for ad hoc titles, substituting the size and work type
- Use a size-only prefix such as `[M] Concrete change` for work recorded under its original owner
- Name the actual code, configuration, or UI change, not an explanation or discussion about it
- Group the preview under Small, Medium, and Large
    - When asked for names, show the grouped names directly, not a report that drafts were updated
    - Mark existing-parent placement and proposed existing-issue renames beside the affected titles

## Prepare concise records

Keep each outcome's body to:
- **Why:** The problem or need
- **Delivered:** What actually changed, including material proof limits
- **PRs:** Linked implementation evidence
- **Size:** Small, Medium, or Large

Use this completed-work format instead of a prospective issue's implementation plan. Ordinary new-work issues belong to `github-issue-authoring`

Keep one batch manifest with stable outcome IDs, exact titles and bodies, PR links, size, repository, assignee, existing-issue disposition, native parent, labels, and intended board placement

- Assign new records to the person and close them as completed
- If the approved batch creates a `Delivered Items` parent:
    - Apply the `ad hoc` label
    - Make it the only new Done board card
- Preserve existing board placements and unrelated metadata
- Treat an existing issue's rename, comment, or body replacement as separate explicit actions in the batch

## Publish and reconcile

- Publish from the approved batch, retaining each created issue's ID and URL as it succeeds
- Attach native sub-issues in Small, Medium, and Large order
- Use bounded API batches and inspect live state after a partial or ambiguous write before continuing
- Check project membership after hierarchy attachment
    - GitHub automation can add child cards during creation or attachment
    - Remove only cards newly created by this batch when they conflict with the parent-only layout
    - Do not change shared project automation or pre-existing cards
- Read back the exact titles, bodies, assignments, completed state, labels, native parents, ordering, and board membership
    - Check reused issues against their pre-publication metadata
    - Confirm broader unfinished parents remain open
- Report the parent link, existing-parent exceptions, and any remaining discrepancy
