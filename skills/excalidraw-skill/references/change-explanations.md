# Explain a Change, Not the Whole System

Use this pattern when the reader asks what changes, how a proposal differs from a baseline, or why a feature matters. The goal is one memorable contrast in behavior or responsibility, not an inventory of components

## Choose the view

- Write the one-sentence takeaway and name the intended reader
- For a comparison, name the baseline from the supplied evidence, such as deployed behavior or an approved design
    - Label the other side as proposed or implemented according to its actual status
    - If the baseline is unknown, ask for it when the comparison needs it, or show only the supported design
- Use adjacent before/after views when the contrast answers the reader's question
- Use a topology view for ownership or connectivity, and a sequence for ordering or handoffs
    - A request for a topology or sequence does not need an invented before/after comparison

## Select the content

- Choose detail from the reader's question, not the amount of supplied information
    - A change explanation shows what changes and why it matters
    - An operational walkthrough shows the decisions, ordering, and failure paths needed to follow the process
- For a change explanation, use the existing semantic-cut gate to propose where each fact belongs
    - Main visual: facts that establish the central change
    - Supporting visual: facts needed to understand a consequence of that change
    - Boundary note: facts that prevent a likely false interpretation
    - Accompanying text: implementation mechanics that do not change the takeaway
    - Keep a mechanic in the visual when a required visual claim depends on it
- Give each supporting panel a reader question to answer, rather than using it as a bucket for remaining details
- Read the main labels without their explanations. If they do not communicate the takeaway, revise the labels or hierarchy before adding more detail

## Build the comparison hierarchy

Apply this section to a comparison view. For a single-design topology or sequence, make the supported ownership or ordered handoff dominant instead of adding paired before/after panels

- Give the core contrast the largest panel, with before on the left and the changed behavior on the right
    - Put both sides at the same level of detail and follow the same reading order
    - For a narrow layout, stack before above after while preserving the paired comparison
- Put the headline behavior in a short box on each side
    - Name an owner and action where useful, such as "Worker builds report"
    - Put the reason and supporting facts beside or below the box instead of turning it into a paragraph
- Use smaller supporting panels only when they answer distinct questions about the change
    - Keep each local comparison together, so the reader need not look across unrelated panels
    - Choose panel count from the claims, not from a fixed three-panel template
    - A single coherent change may need only one panel
- Label supporting concerns by their actual relationship to the core
    - **Required:** part of the core behavior or a necessary dependency
    - **Optional:** an addition that can be omitted while the core still works
    - **Conditional:** required when a named mode is used
    - **Unchanged:** an evidenced invariant, not an assumed guarantee
    - If two additions depend on each other, show that dependency rather than implying independent adoption
- Show shared context once, with a nearby note spanning the relevant comparison
    - Keep a failure or exception beside the behavior it qualifies
    - Show unchanged safeguards only when they prevent a likely misunderstanding of the change
- Keep arrows local to an actual flow, handoff, or dependency
    - Use alignment and whitespace to pair before/after claims. The comparison itself needs no arrow
    - A comparison has a takeaway, not a fabricated start or finish node
- Add a short **Why** caption when the source supplies the reason
    - Distinguish the mechanism from its intended benefit
    - Label intended benefits as goals unless the supplied evidence establishes an observed result
- Use the existing style reference for shapes, type, and color
    - Keep matching roles visually consistent across the comparison
    - Make the change identifiable from words and structure, even without color

## Propose the composition in text

Before drawing when the composition needs agreement, return:

- **Takeaway:** what the reader should understand, the chosen view, and the baseline when comparing
- **Layout:** a compact ASCII outline with the actual panel headings and headline labels
- **Local meaning:** the important arrows, nearby reasons, dependencies, and exceptions
- **Content boundary:** what is abstracted, excluded, or still unknown, using the existing semantic-cut gate

Explain briefly why the chosen hierarchy makes the subject easier to understand. Use the style and quality references for the later rendering checks. A text outline does not demonstrate visual legibility

## Examples: borrow the judgment, not the subject matter

### One change, one panel

Input: an approved report design replaces inline report building with a queued worker. The request should return a job ID instead of waiting for report completion. Access checks stay the same

```text
REPORT EXECUTION
Before                         Proposed
Request builds report          Request queues -> Worker builds
Caller waits for report        Caller receives job ID

Why: return before report completion
Unchanged: access checks
```

One panel explains the change. There is no invented optional feature or claimed speed measurement

### Core plus a genuinely optional addition

Input: a proposed inventory feed replaces each storefront's polling with a shared feed. A history viewer may be added independently. The feed works without it. Stock ownership stays with the inventory service

- Largest panel: "Storefronts poll separately" beside "Storefronts consume shared feed"
- Smaller panel: "Optional history viewer" with its own feed-to-viewer relationship
- Shared note: "Inventory service still owns stock"

The smaller panel makes independent adoption visible without making the viewer a prerequisite

### A dependency is not an optional feature

Input: publication follows review -> approval -> publish. Signing is mandatory for external publication and absent for internal publication. No previous design is given

Use a sequence with signing on the external-publication branch, labeled "Required for external publication". Do not invent a before lane or call signing independently optional

## Instruction-design references

- [Anthropic prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices): explicit output, positive instructions, separated examples, varied cases
- [Anthropic skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices): concise entrypoint, linked detail, appropriate freedom, fresh-instance evaluation
