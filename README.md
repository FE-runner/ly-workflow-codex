# ly-workflow-codex

[English](./README.md) | [简体中文](./README.zh-CN.md)

> A single-agent workflow for **Codex and Claude Code**: one session handles exploration, proposals, implementation, and review orchestration end to end, and both hosts share the same command flow. The review and implementation executors are controlled by the current host's `[host] reviewExecutor` / `codingExecutor`; when unset, both are equivalent to `main` (the main agent executes directly), and `subagent` explicitly opts into spawning independent subagents (non-fork + scoped tasks; soft context reaches them through the change-level `context.md`). Slow validation (tests / type checking / build) runs once in the pre-archive gate owned by `@lyx-archive`. The workflow reuses OpenSpec native flows wherever possible.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

## Installation

```bash
npx ly-workflow-codex        # Interactive menu with OpenSpec dependency preflight
npx ly-workflow-codex init   # Choose hosts, install 14 skills + config; OpenSpec check-only by default
npx ly-workflow-codex init --init-openspec  # After host confirmation, initialize the current project's OpenSpec root/skills for the selected hosts
lycx init --skip-prompt --host claude       # Non-interactive, limited to the given hosts
```

- CLI binary: `lycx` (subcommands: `init` / `doctor` / `status` / `uninstall` / `openspec inspect|ensure`, all accepting `--host <codex,claude>` — default is every installed host; running it without a subcommand opens the menu; `update` is available from the menu)
- Installed artifacts and config: see [Hosts](#hosts) below
- Config: one file per host (`~/.codex/lyx/config.toml` / `~/.claude/lyx/config.toml`; the file existing means the host is installed), private to ly-workflow-codex and is fully decoupled from any legacy workflow directory, with no automatic migration. `[host] spawnableModels` (codex only) declares models known to be spawnable on the current machine (advisory only; it is not used as a candidate or validation source; when unset or blank, the built-in defaults are gpt-6-astra / gpt-5.6-sol / gpt-5.6-terra / gpt-5.6-luna / gpt-5.5). Maintenance is currently manual config editing; an interactive editor is planned.
- Executors and reasoning effort: `[host] reviewExecutor` / `codingExecutor` (`main` / `subagent`; unset means `main`) decide who performs review and implementation. `reviewReasoningEffort` / `codingReasoningEffort` correspond to `reviewModel` / `codingModel` and are only passed as `reasoning_effort` when the matching executor is `subagent` and the value is non-empty. When the executor is `main`, model and reasoning-effort fields do not take effect and `lycx doctor` prints a WARN. Values are not strictly enum-validated. Interactive `init` and the menu can either leave a value untracked (inherit defaults) or override it; non-interactive updates preserve existing values.
- Init wizard flow: language → **host selection** (defaults follow installed hosts and whether `~/.codex` / `~/.claude` exist) → per host: **Claude Code asks only for the two executors** (no provider / model / reasoning-effort collection, and Claude Code's own provider config is never written); **Codex**: API provider (existing `[model_providers.*]` in `~/.codex/config.toml` / OpenAI official / custom) → **Codex state detection (read-only)**: top-level `model` in `~/.codex/config.toml`, provider entries, and the size of `~/.codex/models.json` → executor choices → model and reasoning-effort collection (model candidates = **inherit current session model by leaving blank** + **custom input** + existing value; reasoning-effort candidates = **do not override (inherit default)** + suggested levels + custom input + existing value; provider `/models` and any built-in/maintained list are not candidate sources) → config summary.

## Hosts

| | Codex | Claude Code |
|---|---|---|
| Invocation | `@lyx-<command>` | `/lyx-<command>` |
| Commands | `~/.agents/skills/lyx-*/SKILL.md` | `~/.claude/skills/lyx-*/SKILL.md` |
| Role prompts / subagents | `~/.codex/lyx/prompts/codex/` (ROLE_FILE) | `~/.claude/agents/lyx-{plan-reviewer,reviewer,implementer}.md` (always installed) |
| Config | `~/.codex/lyx/config.toml` | `~/.claude/lyx/config.toml` |
| Subagent model / effort | passed per spawn from `[host]` | rendered into the agent definitions (`model: inherit` when unset); `lycx doctor` flags drift, `lycx update` re-renders |

- **Two review paths on both hosts**: `main` (default) = the main agent reviews / implements directly, with the full grading, Critical-clearing, 2-round self-review and snapshot semantics; `subagent` (optional) = an independent non-fork subagent. On Claude Code the subagent is a custom agent invoked with the `Agent` tool and continued with `SendMessage`; in interactive mode it runs in the background, so "waiting" means "the result must be consumed and reported", never an in-turn synchronous block. If a subagent cannot run, the command prints `[回退] subagent 不可用: <error>` and falls back to the main agent.
- **Host boundary**: the shared installer only knows the adapter interface and host registry; host specifics live in `src/hosts/<id>/` and `templates/hosts/<id>/`. lyx never writes Claude Code's own provider / settings, and uninstalling never touches OpenSpec's own artifacts (`.claude/commands/opsx/`, `.claude/skills/openspec-*`) or the shared `~/.ly/worktrees/`.
- **`@lyx-init` on Claude Code** additionally produces a `CLAUDE.md` that imports `AGENTS.md` (`@AGENTS.md`), because Claude Code only reads `AGENTS.md` when the project has no `CLAUDE.md`.
- `@lyx-<command>` in the docs below is a command identifier; use `/lyx-<command>` on Claude Code.

## Commands (14 `@lyx-*` Skills)

| Command | Purpose |
|---------|---------|
| `@lyx-init` | Generate project `AGENTS.md` + initialize the OpenSpec directory structure + auto commit |
| `@lyx-explore` | Think before acting (delegates to `@openspec-explore skill`); before delegating, it scans for `review-findings.md` unresolved-review snapshots and **asks** before listing them; when the discussion converges, it points to `@lyx-propose` |
| `@lyx-propose` | Ask once for isolation mode (three choices: isolated worktree [cut from the current branch HEAD, continue in the same session after `cd`; the resume command is only an exception fallback] / new branch in the current project [branch-only isolation, with dirty-worktree handling] / stay on the current branch) + ask "fully automatic / manual" → delegate to `@openspec-propose skill` → record `sourceBranch` / `developmentBranch` / `worktreePath` metadata → proposal self-review (four checks + itemized conclusion list; mechanical gaps are fixed directly, business decisions are asked to the user) → commit `propose: <change>`; fully automatic = review-plan → apply → review-code pipeline, manual = confirm step by step |
| `@lyx-apply` | **Implement according to `codingExecutor`**: `main` (default) = the main agent directly reads `tasks.md`, implements each task, verifies, and checks the checkbox; `subagent` = spawn a coding subagent (non-fork; soft context comes from `context.md`; only the change scope is implemented; model follows `codingModel`). Both paths return to the main session for confirmation, update `context.md`, and commit `apply: <change>` under the main session. If the subagent path is unavailable at the environment level, it falls back to the main agent; business failures stop for human handling. |
| `@lyx-archive` | Archive a completed change (delegates to `@openspec-archive-change skill`) + auto commit + prompt to merge back to `sourceBranch` and clean up the worktree / development branch according to isolation metadata |
| `@lyx-review-plan` | Review the proposal: the executor is chosen by `reviewExecutor`. `main` (default) = the main agent reviews directly, with no itemized adjudication / rejection stop line and at most 2 rounds; `subagent` = a single review subagent (role prompt `plan-reviewer.md`, non-fork + `context.md` path reference, model follows `reviewModel`) produces severity-graded findings, and the main session adjudicates each item until Critical is cleared or a termination condition is hit (global round limit 5, clearing takes priority). Fixes are committed once after clearing. After the loop it writes the `## 方案审查` section of `review-findings.md` (Warning only). |
| `@lyx-review-code` | Review code: same model as above (role prompt `reviewer.md`), with Critical / Warning / Info severity levels. After the loop it writes the `## 代码审查` section of `review-findings.md` (Warning only). |
| `@lyx-release` | Four GitFlow release scenarios (feature / release / hotfix / dev-offline), with SemVer inferred automatically; choose remote PR merge by default or local direct merge, and detect the main branch name (`master` / `main`) |
| `@lyx-changelog` | Generate or update `CHANGELOG.md` in Keep a Changelog format, grouped by commit prefix |
| `@lyx-publish` | Four npm publishing scenarios (bmc private Nexus / GitHub Packages / npmjs + GitHub Release / CI auto publish), from preflight → version inference → build → publish → verification |
| `@lyx-commit` `@lyx-rollback` `@lyx-clean-branches` `@lyx-worktree` | Git tools (worktree only has `add` / `list` / `remove` / `prune` / `migrate`; `switch` is removed, and isolation switching is always triggered by `@lyx-propose`) |

Review-fix loop details (executor branches, `send_input` reuse and incremental passing for subagent paths, termination conditions, and commit timing) are inlined in each skill template (`@lyx-review-plan` / `@lyx-review-code`). [docs/codex-exec-contract.md](./docs/codex-exec-contract.md) is DEPRECATED and kept only for historical reference.

## Typical Workflow

```bash
@lyx-init
@lyx-propose "what you want to build"    # Isolation choice + automatic/manual mode
@lyx-review-plan                         # Review the proposal (single non-fork review subagent)
@lyx-apply                               # Coding subagent implements + main session commits
@lyx-review-code                         # Review the code (single non-fork review subagent)
@lyx-archive
```

## Architecture

- **Single-agent orchestration on either host**: the current Codex or Claude Code session handles the full exploration → proposal → self-review → implementation → fix cycle. There is no wrapper, no Web UI, and no routing / implementer backend selection.
- **Review gate = switchable executor**: `reviewExecutor = "main"` (default) = the main agent reviews directly, with no spawn, no itemized adjudication, and no rejection stop line, for at most 2 rounds; `reviewExecutor = "subagent"` = each gate spawns 1 review subagent (non-fork; only TASK + the change scope), soft context reaches it through `context.md`, and every Critical item is adjudicated by the main session. A rejection must include verifiable evidence. Rejection stop lines (the same Critical appears again after rejection, or 2 consecutive rounds reject all findings) immediately stop for human handling. In the subagent path, round 2 onward reuses the same subagent via `send_input` by default, and only re-spawns if reuse fails.
- **Apply = switchable executor**: `codingExecutor = "main"` (default) = the main agent implements directly; `codingExecutor = "subagent"` = spawn a coding subagent (non-fork; only the change scope; soft context from `context.md`). Both paths are committed once by the main session as `apply: <change-name>`.
- **Unresolved-review snapshot = `review-findings.md`** (a snapshot for later reading, not a tracking backlog): review-plan / review-code upsert their section at loop end with the last round's **Warning** findings only (no Info, no Critical), numbered so each item has a stable anchor. On a normal clear it is written **after** the unified commit (kept untracked), then rides along with `@lyx-archive`'s `git add -- openspec/` into the archived change directory. `@lyx-explore` scans for it, asks before listing, and shows how many items carry a resolution note. When a later change resolves a historical Warning, it declares the exact anchor in `proposal.md`'s `## 解决的审查未修项` section; `@lyx-archive` appends an append-only resolution note under that Warning (original text unchanged, idempotent, failures never block archiving). The file is excluded from the review scope and from intermediate commits.
- **Agent models and reasoning effort require explicit config (no strict list validation)**: review-plan / review-code / apply follow the "template instruction + host spawn capability" model. Model = the matching config field; unset or blank → inherit the current session model. Reasoning effort = `reviewReasoningEffort` / `codingReasoningEffort`, passed as `reasoning_effort` only when non-empty; blank values are omitted. Values are not enum-validated. Interactive `init` / menu can explicitly choose "do not override" (clear the field) or override a level; non-interactive update preserves existing values. Whether a model can be spawned is determined by the runtime host and the actual spawn error. If the error contains `Unknown model ... Available models: ...`, show it verbatim and suggest an available model. Config read failure → "config state unknown", prompt to run `lycx doctor`. Missing host subagent capability or initial spawn failure → fall back as an environment-level unavailability. `lycx doctor` groups checks per host; for Codex it includes a "Codex subagent model config" check item (blank model OK / configured OK; both reasoning-effort fields show "not overridden / overridden"; malformed `spawnableModels` emits WARN) and includes an example prompt for verifying whether a model can be spawned.
- **Release**: pushing a `v*.*.*` tag triggers GitHub Actions to publish the npm package. There is no separate binary build step.
- **Lifecycle**: directly delegate to OpenSpec native skills (per host: `openspec init --tools codex|claude`; skills are judged in each host's own skill roots and repaired only for the host that is missing them) (`@openspec-explore` / `@openspec-propose` / `@openspec-apply-change` / `@openspec-archive-change`). `lycx init`, `@lyx-init`, and `lycx doctor` share the same three-layer OpenSpec dependency check (CLI + profile-derived skills + `openspec doctor --json` root health). `lycx init` only diagnoses by default and does not write to the current project; `--init-openspec` or `@lyx-init` performs project-level repair. When skills are only available globally, it prints a `global-only` WARN and continues.

## License

MIT
