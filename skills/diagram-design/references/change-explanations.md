# Change explanation examples (optional)

Consult when a comparison's baseline, dependency, or optionality is ambiguous. These examples illustrate distinctions, not a required panel template or subject matter

## One actual change

An approved report design replaces inline building with a queued worker. The request returns a job ID rather than waiting for completion. Access checks stay the same

```text
REPORT EXECUTION
Actual baseline                 Proposed
Request builds report          Request queues → Worker builds
Caller waits for report        Caller receives job ID
Why: return before report completion
Unchanged: access checks
```

- Pair the changed behavior at comparable detail and show shared safeguards once when they prevent misunderstanding
- Do not invent an optional feature or claim a measured speed improvement
- If no actual baseline is known, show only the supported design or resolve the comparison's baseline first
  - An earlier sketch is not the baseline unless the user is comparing sketches

## Core plus an independent addition

A proposed shared feed replaces each storefront's polling. A history viewer may be added independently. The feed works without it. The inventory service still owns stock

- Dominant comparison: “Storefronts poll separately” versus “Storefronts consume shared feed”
- Subordinate, nearby concern: “Optional history viewer” with its feed-to-viewer relationship
- Shared note: “Inventory service still owns stock”

The viewer is genuinely optional, not a prerequisite. Give supporting views their own reader question without forcing a particular number or geometry of panels

## Conditional dependency, not an independent option

Publication proceeds through review → approval → publish. Signing is required for external publication and absent internally. No earlier design is given

- Show a sequence with signing on the external branch labeled “Required for external publication”
- Do not invent a before lane or call signing independently optional
- Put the condition next to the affected transition
- Show a sourced reason as a reason, and distinguish an intended benefit from an observed result
