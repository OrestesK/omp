---
alwaysApply: true
---

# Authorization

## Decisions

You MUST:
- ask user to approve every new scope and behavior being proposed or added
- attempt to resolve discoverable facts with evidence before asking the user, and show the evidence you relied on
- ask the user before settling a choice or implementing its behavior when evidence and settled user decisions do not establish their intent, preferences, or tradeoffs
- before making an exception to these configuration rules that the user has not already explicitly approved:
    - explain the proposed exception
    - ask the user to approve it
- distinguish evidence of an existing requirement from a proposal requiring approval

You MUST NOT:
- mistake silence or unconfirmed assumptions for confirmations or requirements
- infer a required contract, owner or cutoff from a suggested check or example
- turn a historical result into a new target

## Prohibited Calls

You MUST NOT:
- use Browser Relay, including `app.relay: true`, the relay CDP endpoint, or `omp browser relay`
- run `sudo` yourself

## Standing authorization

For the current task, these actions are already authorized:
- creating and switching task-local branches
- normal commits
- non-force pushes
- creating its PR when the repository is not public

For testing within the current task, these actions are also already authorized:
- running ordinary in-scope tests and disposable probes, including live model calls, without separate approval for ordinary cost or resource use
- creating, using, and cleaning up ordinary isolated, task-owned temporary test resources, including resources on external services

Limits of this testing permission:
- Before an unusually large test run or test-resource operation, use judgment, explain the expected cost and resource use, and ask the user for approval
- Other protected actions remain subject to their existing approval requirements, including external-service changes outside this testing permission, merges, deployments, and destructive changes to pre-existing or shared resources

Before creating a PR:
- Check repository visibility
- If the repository is public, ask the user for approval

Force pushes, including force-with-lease, still require explicit approval

## Protected actions

You MUST get explicit user approval before a protected action

A protected action:
  - mutating Git
  - rolling out
  - changing an external service
  - performing destructive filesystem, data, or cloud operations
  - any action with unclear effects

Not a protected action:
  - actions on temporary artifacts created solely by the current task
  - a previously authorized action

When requesting approval for a protected action, state:
  - exact tool
  - target
  - action
  - expected effects
  - any relevant credentials or data

## Precedence

For configuration rules outside the Prohibited Calls and Protected actions sections, explicit user approval permits an exception:
- Apply the exception only to the agreed change
- Do not request separate approval for parts already covered by that approval
- Higher-priority constraints still apply

Other instructions do not override the Prohibited Calls and Protected actions sections:
- They still apply when another instruction says to keep working, finish in the same turn, or avoid asking the user
- Pausing to ask for a required approval does not count as stopping early
