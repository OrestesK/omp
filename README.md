# omp

Personal configuration for [Oh My Pi](https://github.com/can1357/oh-my-pi) (`omp`), a coding agent.

![omp TUI](assets/demo.png)

## Approach

- **Approval first:** new scope and protected actions (Git, rollouts, external services, destructive operations) need explicit approval
- **Evidence over plausibility:** claims carry evidence and a confidence label; proven claims are marked `VERIFIED`
- **Delegation by default:** the main agent plans and splits work; subagents do bounded slices
- **Independent review:** nontrivial proposals and implementations get a fresh reviewer before they count as done

## Layout

| Group | Path | Holds |
| --- | --- | --- |
| Instructions | `AGENTS.md` | Discussion, escalation, progress, delegation, and review rules |
| | `PERSONALITY.md` | Engineering values and communication style |
| | `rules/` | Always-on rules: authorization, coding, and subagent behavior |
| Capabilities | `agents/` | Custom subagents |
| | `skills/` | Task-specific procedures, loaded when a task matches |
| | `prompts/` | Slash prompts |
| | `extensions/` | TUI tweaks and an observational-memory extension |
| Settings | `config.yml` | Models, UI, tools, memory, and extension settings |
| | `mcp.json` | MCP servers |
| | `models.yml` | Provider setup (API key read from the environment) |
| | `themes/` | Terminal theme |

## Agents

| Agent | Access | Purpose |
| --- | --- | --- |
| `reviewer` | Read-only | Evidence-backed review of one assigned angle |
| `web-researcher` | Read-only | External research with citations and evidence notes |
| `run-monitor` | Observe | Non-blocking watch over a running command, process, or log |
| `slice-writer` | Writes | One writable slice when several implementation agents run at once |

## Skills

### Planning and design

| Skill | Purpose |
| --- | --- |
| `grill-me` | Interview the user until a plan or idea is understood |
| `excalidraw-skill` | Create, refine, validate, and export Excalidraw diagrams |

### Engineering

| Skill | Purpose |
| --- | --- |
| `review` | Independent review of proposals, implementations, or code |
| `semantic-git` | Changed functions, semantic diffs, impact analysis, and blame |

### Git and GitHub

| Skill | Purpose |
| --- | --- |
| `commit` | Commit messages and branch names |
| `github-issue-authoring` | Triage, draft, or improve issues from verified evidence |
| `github-pull-requests` | Prepare, review, update, and respond to PRs |
| `github-pr-comments` | Draft and place PR review comments from validated findings |
| `pr-review-handoff` | Hand off your own PR for human review |

### Agent configuration

| Skill | Purpose |
| --- | --- |
| `pi-config` | Keep OMP instructions, agents, skills, and prompts consistent |
| `skill-authoring` | Write and revise skill instructions |
| `session-analysis` | Reconstruct past sessions, errors, and workflow friction |

### Work-specific

| Skill | Purpose |
| --- | --- |
| `notion-documents` | Write and format Notion pages |
| `pr-slack-post` | Slack message sharing a PR for review |
| `vals-memory` | Symlink to a private work skill; not included here |

## Prompts

| Prompt | Purpose |
| --- | --- |
| `brief-me` | Brief me on the current work, then continue |
| `simplify-me` | Rewrite the previous response in plain language |

## Extensions

| Group | Extension | Purpose |
| --- | --- | --- |
| TUI | `UI/compact-eval.ts` | Compact rendering of Eval tool calls and results |
| | `UI/response-phase.ts` | Shows waiting, thinking, streaming, and tool phases |
| | `UI/user-message-frame.ts` | Frames user messages with a labeled divider |
| | `UI/sixel-submit-preview.ts` | Previews pasted images in Sixel terminals |
| Input | `quit.ts` | `:q` quits the interactive session |
| Memory | `observational-memory/` | Enabled observational context alongside native compaction and Mnemopi |

`observational-memory` is enabled in this live patched OMP setup. See the [observational-memory guide](extensions/observational-memory/README.md) for details.

- It records branch-local observations and reflections in the session ledger, with source-linked evidence available through `observation_recall`
- After a successful native remote or handoff compaction, OMP adds a snapshot as a separate context note without replacing its summary. Later observations wait for the next successful compaction
- Mnemopi remains the separate memory backend, while OMP owns remote→handoff compaction

The extension is ported from `pi-observational-memory` (MIT, see its [LICENSE](extensions/observational-memory/LICENSE)).

## Using it

1. **Install** the patched OMP host with `registerCompactionSnapshot` support and configure credentials for the provider you use
2. **Clone** into the agent directory this setup uses:

    ```sh
    git clone https://github.com/OrestesK/omp.git ~/.config/omp/agent
    PI_CODING_AGENT_DIR="$HOME/.config/omp/agent" omp
    ```

    OMP's default agent directory is `~/.omp/agent`; `PI_CODING_AGENT_DIR` points it here.
3. **Authorize MCP servers** when each one prompts on first use

Notes:

- Extension paths in `config.yml` use `~/`. `~/Sources/pisesh` is a local extension not in this repo
- Private MCP servers go in an untracked `.mcp.json` next to `mcp.json`; OMP reads both

## License

MIT. See [LICENSE](LICENSE).
