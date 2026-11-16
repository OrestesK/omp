# Design

Optimize for a system that is easier to understand and maintain, not just a smaller or tidier diff

- **Looks for:**
    - whether added behaviors, components, and boundaries are needed for the task's stated objective
    - a simpler, more elegant, or better-structured way to get the same behavior, through structure, abstraction, centralization, or architecture
    - plausible, materially different designs rather than only local cleanups
- **Procedure:**
    - cover each function or coherent group in the assigned scope, including the callers and owners needed to understand its role
    - check whether code or repeated work can be removed, an existing implementation reused, representations reduced, or responsibility placed with an existing owner
    - compare promising alternatives with the current implementation, including behavior preservation, integration cost, coupling, and the code we would maintain
    - record scope coverage and meaningful alternative comparisons in the review report, including why a simpler-looking alternative was rejected
- **Done when:**
    - the assigned scope is covered and promising alternatives have been evaluated
    - each proposed improvement names its location, today's cost, the alternative design, why it is better, and material tradeoffs

<examples>
<example>
A quality pass finds only unused helpers to delete. Evaluate promising changes to structure, abstraction, or centralization before concluding that the review is complete
</example>
<example>
When adapting an existing extension, compare a thin adaptation of its implementation with maintaining a local rewrite, including integration cost and the code we would own
</example>
<example>
An upstream-reuse alternative removes lines but depends on private internals without a clear overall simplification. Keeping the current design can be the better outcome
</example>
</examples>
