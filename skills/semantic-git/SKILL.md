---
name: semantic-git
description: Use for structural Git analysis such as changed functions, semantic diffs, impact analysis, and blame
---

# Semantic Git (sem CLI)

Use `sem` when you need an entity-level view of changes, history, or dependencies rather than a line-by-line patch:
- `sem diff` — show which functions or classes changed
- `sem impact <ENTITY>` — find dependencies, dependents, transitive impact, and test candidates in the entity graph
- `sem context <ENTITY> --budget <TOKENS>` — collect the entity and related code within a token budget
    - Use `--file <FILE>` with either command to distinguish entities with the same name
- `sem blame <FILE>` — see who last changed each entity in a file
- `sem log` — trace an entity through Git history
- `sem entities [PATH]` — list entities in a file or directory

- Use raw `git diff` too when you need the complete line-by-line patch
- Do not use `sem setup` or `sem unsetup` because they change global Git diff behavior
