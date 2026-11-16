---
alwaysApply: true
agents: [main, task, sonic, sub, reviewer, "m[0-9]*"]
---

# Coding

## Tool use

- Prefer Eval to batch `tool.*` calls and process results when you do not need to reason or ask for approval between calls
- Use direct tools for simple one-off calls

## Coding implementation

You MUST NOT treat the following as default improvements. You MUST treat them as optional increases in scope. You MUST NOT produce code that contains them unless authorized:
- data sanitization
- security hardening
- recovery
- error mapping and wrapping
- compatibility
  - MUST know what behavior is proven released, deployed, or externally consumed
  - MUST NOT assume without asking the user

You MUST NOT include any of these in your code:
- defensive coding
- unnecessary type checking and coercion
- code handling cases not proven
- optionality
- defaults
- filtering
- repair
- unnecessary or unrelated git diff introduced by you

You MUST NOT:
- preserve rejected or superseded ideas in code, tests, documentation, comments, schemas, or completion claims
- run tests or type checks unrelated to your change, or linters or formatters, unless the user requests them

You MUST:
  - trace real producers, data shapes, runtime paths, and trust owned types and invariants
  - update comments to reflect changed behavior, remove comments made obsolete by your change, and keep other comments unless the user approves removal
  - when adapting an existing implementation, compare reusing it with rewriting it. Consider the code we would maintain and the integration cost
  - review comments and documentation in the changed work for necessity, concision, and consistency with surrounding style

### Permanent coverage

- Plan coverage early
- Prefer simple, coherent integration tests that protect consumer-visible behavior
    - One scenario may cover multiple relevant outcomes
    - Leave sufficient existing integration coverage unchanged
    - If coverage is insufficient, recommend extending a coherent existing test or adding a new one
- Add focused unit tests only when core logic gains substantial protection beyond integration coverage, not for every function

### Approval

- Ask the user before adding permanent coverage, including additions to existing tests
    - Explain the behavior and plausible failure it protects and why existing coverage is insufficient
    - Ask early enough that an approved integration test can precede implementation when useful, without mandatory test-first development
- Do not ask when recommending no new coverage
- Run existing tests and disposable probes without separate test-writing approval

### Live proof

- Exercise and observe the actual consumer-facing changed path with relevant real dependencies
    - Local or DEV execution qualifies
- A passing integration run provides live proof when it genuinely exercises that path and dependencies
    - Do not require a second disposable probe solely for proof
- Do not silently substitute mocked tests or source inspection for live proof
- Do not claim the work verified or complete before required live verification passes

## Requirement trace

You MUST assign stable IDs to requirements in the active task

Once assigned, you MUST:
- add requirement provenance, runtime entrypoints, owners, and planned proof when you find it useful
- treat unclear requirement relationships as separate proposals and scope
- have every material change support an approved requirement
- carry IDs through all steps until the task is complete
- mark all derived components from a requirement as stale until refreshed if it changes
- account for each requirement in final evidence
