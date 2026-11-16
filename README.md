# omp

Personal configuration for [Oh My Pi](https://github.com/can1357/oh-my-pi) (`omp`), a coding agent.

![omp TUI](assets/demo.png)

## Approach

- **Approval first:** new scope and [protected actions](rules/authorization.md#protected-actions), such as merges, force pushes, rollouts, external-service changes, and destructive operations, need explicit approval
- **Evidence over plausibility:** claims carry evidence and a confidence label; proven claims are marked `VERIFIED`
- **Delegation by default:** the main agent plans and splits work; subagents do bounded slices
- **Independent review:** nontrivial proposals and implementations get a fresh reviewer before they count as done

## Layout

| Group | Path | Holds |
| --- | --- | --- |
| Instructions | `AGENTS.md` | Escalation, progress-report triggers, delegation, and review rules |
| | `PERSONALITY.md` | Engineering values and communication style |
| | `rules/` | Always-on rules: authorization, coding, subagent behavior, workspace storage, and `communication.md` for understanding, decisions, progress content, presentation, and feedback |
| Capabilities | `agents/` | Custom subagents |
| | `skills/` | Task-specific procedures, loaded when a task matches |
| | `prompts/` | Slash prompts |
| | `extensions/` | TUI tweaks and an observational-memory extension |
| | `packages/pisesh/` | Included, pinned `OrestesK/pisesh` Git submodule providing `/sesh` |
| | `packages/omp-local/` | Staged updater, launcher, and maintained host source patches |
| Settings | `config.yml` | Models, UI, tools, memory, and extension settings |
| | `.env` | Native environment defaults; `TMPDIR=/var/tmp` for disk-backed temporary files |
| | `mcp.json` | MCP servers |
| | `models.yml` | Provider setup (API key read from the environment) |
| | `themes/` | Terminal theme |

## Agents

| Agent | Access | Purpose |
| --- | --- | --- |
| `reviewer` | Read-only | Evidence-backed review of one assigned angle |
| `web-researcher` | Read-only | External research with citations and evidence notes |
| `run-monitor` | Observe | Non-blocking watch over a running command, process, or log |

## Skills

### Planning and design

| Skill | Purpose |
| --- | --- |
| `grill-me` | Interview the user until a plan or idea is understood |
| `diagram-design` | Plan, create, revise, and review diagrams across formats with local style and rendered validation |
| `excalidraw-skill` | Operate, audit, and export Excalidraw native scenes using the Excalidraw style profile |

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
| `editing-omp-config` | Keep OMP instructions, agents, skills, and prompts consistent |
| `session-analysis` | Reconstruct past sessions, errors, and workflow friction |

### Work-specific

| Skill | Purpose |
| --- | --- |
| `authenticated-web-access` | Reuse an existing Firefox login for bounded authenticated website requests |
| `delivery-retrospectives` | Inventory shipped PR-backed work and draft Delivered Items retrospective tickets |
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
| | `review-draft/` | Agent-callable and manual draft review in a right-side tmux pane |
| Memory | `observational-memory/` | Enabled observational context alongside native compaction and Mnemopi |

`observational-memory` is enabled in this live patched OMP setup. See the [observational-memory guide](extensions/observational-memory/README.md) for details.

- It records branch-local observations and reflections in the session ledger, with source-linked evidence available through `observation_recall`
- After a successful native remote or handoff compaction, OMP adds a snapshot as a separate context note without replacing its summary. Later observations wait for the next successful compaction
- Mnemopi remains the separate memory backend, while OMP owns remote→handoff compaction

The extension is ported from `pi-observational-memory` (MIT, see its [LICENSE](extensions/observational-memory/LICENSE)).

### Draft review

Start a new OMP session to load the extension and the always-on communication rule. Review requires tmux, the interactive OMP TUI, `nvim` on `PATH`, and `/usr/bin/diff`. Install the extension package with `cd ~/.config/omp/agent/extensions/review-draft && bun install --ignore-scripts`.

Run `/review-draft /absolute/path/to/draft.md` manually, or let the agent call `review_draft` with a `path` argument. Both open an exact temporary copy in Neovim in a focused right-side tmux pane and return immediately. OMP stays visible and unblocked; you can switch between tmux panes while editing.

- Edit the text or add `!!` review comments below the relevant passage as ordinary text
- `:wq` sends the contextual diff asynchronously to the agent, without another Enter; an unchanged copy reports no changes
- `:cq` or closing the review tmux pane cancels without sending feedback, including changes saved earlier in that review

Switching OMP conversations cancels a pending review and closes its pane; delayed feedback is not sent to another conversation. On normal exit, OMP waits for review cleanup within its shutdown deadline. The reviewer leaves the original file untouched. The agent treats `!!` annotations as feedback, not draft text. Presentation and approval policy lives in [the always-on communication rule](rules/communication.md).

## Local host patches

`packages/omp-local/patches.json` lists three maintained source patches: observational-memory host support, isolated JavaScript eval workers, and minimal-base-prompt false-wrapper exclusions. The host uses upstream tools rather than a Code Mode integration. The prompt patch retains runtime cues and tool catalog/UI guidance while suppressing bundled workflow, delivery, test-quality, and verification instructions. Personal rules govern testing and live verification. Builds use a complete upstream release checkout and matching published native binaries.

With the local launcher installed, `omp update` stages the latest stable release, applies the manifest patches without fuzz, builds, runs the affected host tests and isolated memory/packaged-CLI smoke checks, and switches `~/.local/share/omp-local/current` only after success. Running sessions and previous release directories are left intact.

```sh
omp update --check
omp update --version 18.12.6
omp update --force
```

A conflict or failed check leaves the active release unchanged and prints the retained staging directory. Ask an agent to update the patch files in `packages/omp-local/patches/`, then rerun the pinned update. Do not repair only the generated bundle or staged checkout: the source patches are the maintained copy.

The updater prints the previous release path. To roll back future launches, point `~/.local/share/omp-local/current` at that retained release. `omp update --plugins` still updates plugins; canary/channel-switch options are not supported by this stable-release updater. A direct global reinstall bypasses these patches and can replace the launcher.

## Using it

1. **Install prerequisites:** Bun, GNU `patch`, and `tar`; configure credentials for the provider you use
2. **Clone** into the agent directory this setup uses:

    ```sh
    git clone --recurse-submodules https://github.com/OrestesK/omp.git ~/.config/omp/agent
    export PI_CONFIG_DIR=.config/omp
    ```

    `PI_CONFIG_DIR=.config/omp` selects `~/.config/omp` as OMP's config root. Add that export to your shell profile for later sessions.

    For an existing clone, run `git submodule update --init --recursive` from `~/.config/omp/agent`. The config repository's commit pins the included `OrestesK/pisesh` fork at `packages/pisesh/`.

3. **Build and select the patched host:**

    ```sh
    bun ~/.config/omp/agent/packages/omp-local/update.ts --version 18.12.6
    chmod +x ~/.config/omp/agent/packages/omp-local/omp
    ln -sfn "$HOME/.config/omp/agent/packages/omp-local/omp" "$HOME/.bun/bin/omp"
    PI_CODING_AGENT_DIR="$HOME/.config/omp/agent" omp
    ```

    This replaces Bun's `omp` launcher, not its installed package. `PI_CODING_AGENT_DIR` explicitly selects this repo's agent directory.

4. **Authorize MCP servers** when each one prompts on first use

Notes:
- `/sesh` loads from the included checkout without npm. To install the standalone `pisesh` CLI optionally, run `cd ~/.config/omp/agent/packages/pisesh && npm link`
- Private MCP servers go in an untracked `.mcp.json` next to `mcp.json`; OMP reads both

## License

MIT. See [LICENSE](LICENSE).
