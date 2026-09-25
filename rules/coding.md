---
alwaysApply: true
agents: [main, task, slice-writer, sonic, sub, reviewer, "m[0-9]*"]
---

# Coding

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

## Requirement trace

You MUST assign stable IDs to requirements in the active task

Once assigned, you MUST:
- add requirement provenance, runtime entrypoints, owners, and planned proof when you find it useful
- treat unclear requirement relationships as separate proposals and scope
- have every material change support an approved requirement
- carry IDs through all steps until the task is complete
- mark all derived components from a requirement as stale until refreshed if it changes
- account for each requirement in final evidence
