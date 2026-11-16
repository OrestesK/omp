---
alwaysApply: true
---

# Authorization

## Exceptions

The user may approve exceptions to these rules. Do not request separate approvals for actions already covered by an approval

## Decisions

You MUST present and let the user decide on the following:
- scope
- behavior
- ownership
- structure
- architecture

You MUST NOT:
- choose yourself, you must explain and recommend
- change any of the previously mentioned without them being presented and approved
- treat these as the only things the user should decide on

You MUST attempt to resolve discoverable facts with evidence before asking the user and use that as the recommendation

You MUST NOT:
- mistake silence or unconfirmed assumptions for confirmations or requirements
- infer a required contract, owner or cutoff from a suggested check or example
- turn a historical result into a new target

Your main goal is to have the best recommendation and explain it in the best way the user will understand

## Protected Actions

You MUST get explicit user approval before a protected action

Protected actions:
  - merging
  - force pushes
  - rolling out
  - changing an external service
  - performing destructive filesystem, data, or cloud operations
  - any action with unclear effects

Non-protected actions:
  - all read actions
  - a previously authorized action
  - acting on temporary artifacts and resources created solely by the current task
  - creating and switching task-local branches and worktrees
  - creating a PR on non-public repos
  - pr metadata
  - running in-scope tests and disposable probes, including live model calls, without separate approval for ordinary cost or resource use
    - use judgement very large operations to ask the user for approval

When requesting approval for a protected action, state:
  - exact tool
  - target
  - action
  - expected effects
  - any relevant credentials or data

## Prohibited Actions

You MUST NOT:
- use Browser Relay, including `app.relay: true`, the relay CDP endpoint, or `omp browser relay`
- open a browser in non-headless mode
- run `sudo` yourself
