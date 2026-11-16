---
name: diagram-design
description: Plan, create, revise, or review diagrams in any format. Not for export-only operations
---

# Diagram design

## Establish meaning

- Establish the intended reader, takeaway, source of truth, required claims, non-goals, and viewing context from the request and evidence
- Resolve a material unanswered choice with the user before committing to its behavior
- Prefer diagrams focused on the change rather than maps of surrounding systems
    - Include surrounding context only when omitting it would make the mechanism unclear or the diagram misleading
- Use topology for ownership or connectivity, and sequence or flow for ordering or state transitions
- Show the mechanism and consequential design decisions needed to explain how and why
    - Make actors, interfaces, dependencies, conditions, and exceptions explicit where relevant
    - Distinguish required, optional, conditional, and unchanged behavior
    - Put a reason and consequence near the change they explain
    - Label an intended benefit as a goal unless evidence establishes an observed result
- Select a central story and supporting detail without silently omitting requested facts or materially abstracting their meaning
    - Use focused detail views when substantial mechanics would crowd the overview
- For a text-only layout request, return a composition with actual labels and local relationships without touching the canvas
- When substantial composition needs agreement, propose it in text before drawing. A text plan does not establish rendered readability

## Compose and revise

- Before composing or rendering, read the [local style guide](references/orestes-clean-style.md)
    - Inspect supplied previews and native scenes when available
    - Borrow established visual grammar, not unrelated technical content or a fixed panel count
- Make the primary comparison, route, or responsibility visually dominant
    - Use containment and whitespace before arrows or color
    - Keep readable supporting detail beside its claim rather than in crowded labels
    - Make actual relationships and ownership unambiguous
- Use concrete human labels and explain unfamiliar domain shorthand
- For a change comparison, match level of detail across states
    - Keep names and role styling consistent unless the underlying name or role changes
    - Keep unchanged components in corresponding positions where useful, without forcing identical layouts when the architecture changes
    - Use matched before-and-after panels when a shared view would obscure the change
    - Keep arrows local to actual flows, handoffs, or dependencies
    - Align comparison claims without a decorative comparison arrow
    - Consult the [varied examples](references/change-explanations.md) when optionality, conditionality, or dependency is ambiguous
- For a local diagram or text-layout revision, retain useful structure and unaffected content unless the user requests replacement
    - When updating a diagram or claiming it is current, reconcile factual labels, ownership, and status with current evidence
    - Correct stale claims without automatically redrawing unaffected regions

## Inspect

- Inspect the final rendered artifact at its intended viewing size when creating or visually changing a diagram
    - Check the takeaway, factual meaning, readable labels, unambiguous connectors, hierarchy, and reference fidelity
    - Correct clipping, collisions, misleading placement, and routes before delivery
    - Use reduced-scale or grayscale inspection when the target use or reliance on color warrants it
    - Tool success and parsable source are not proof of visual or semantic readiness
- Apply governing independent-review requirements without an additional skill-specific quota
    - Review the actual render and source meaning, not only source data or an author's intended fixes

## Deliver

- Deliver the requested artifact and its location
    - Report only validation performed and any material limits
