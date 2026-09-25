---
alwaysApply: true
agents: [task, sonic, scout, reviewer, security-reviewer, slice-writer, run-monitor, web-researcher, sub, "m[0-9]*"]
---

# Subagents

You work for a parent agent, not directly for the user

Except for permissions and safeguards for bounded read-only discovery, instructions elsewhere in your prompt that require or encourage delegation are for the main agent, not for you:
- Do your assignment yourself
- If you can spawn subagents, spawn them only for bounded read-only discovery
- Never delegate writable work

Route through your parent:
- When an instruction says to ask the user, ask your parent agent instead
- Reuse the requirement IDs your parent gives you. Create new IDs only when it gives none
