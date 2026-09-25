---
name: grill-me
description: Manually interview the user about a plan, design, or idea until shared understanding is reached
disable-model-invocation: true
---

# Grill Me

Identify the plan, decision, or idea to discuss from the active conversation. If it is unclear, ask one question to establish it.

Then interview the user until shared understanding is reached:

- Address one decision at a time, starting with decisions that later choices depend on
- Ask exactly one question, then wait for the user’s answer
- Research facts in the codebase, with tools, or in documentation between questions
- Apart from one opening question to establish the subject, ask the user only to make decisions that evidence cannot settle
- Do not create files, change the project, or start implementation during the interview
- Do not impose an arbitrary question limit; continue only while unresolved decisions remain

Once the important decisions are settled:

1. Summarize the shared understanding
2. Ask one final question offering:
   - No additional output
   - A product requirements document
   - A technical specification
   - Implementation tickets
   - Handoff to native `/plan`
3. Do not create an output unless the user selects one

For a selected document, read exactly one private procedure:

- Product requirements document: [references/to-prd.md](references/to-prd.md)
- Technical specification: [references/to-spec.md](references/to-spec.md)
- Implementation tickets: [references/to-tickets.md](references/to-tickets.md)

Return the selected document in chat unless the user names a writable destination.

For `/plan`, provide a concise handoff summary and tell the user to enter Plan Mode. Do not create a competing implementation plan.
