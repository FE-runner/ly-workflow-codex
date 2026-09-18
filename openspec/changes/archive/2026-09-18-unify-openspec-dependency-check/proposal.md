## Why

当前 OpenSpec 依赖前置检查只看“任一 `openspec-*` skill 是否存在”，无法识别只安装在全局、部分 skill 被删除、legacy `.codex/skills` 残留或 OpenSpec root 不健康等状态；`lycx init`、`@lyx-init` 与 `lycx doctor` 也各自使用不同粒度的判定。结果是用户删除了某个 OpenSpec skill 后，检查仍可能静默通过，直到具体 `@lyx-*` 命令调用失败才暴露。

## What Changes

- 新增共享 OpenSpec 依赖检查结果模型：分别检测 CLI、skills、root 三层，并统一输出状态、缺失清单与建议动作。
- skills 检查按 OpenSpec profile 的 workflows 推导必需 skill，不再以“任一 `openspec-*` 存在”判定通过。
- skills 解析同时扫描项目级与全局级目录：`<project>/.agents/skills`、`<project>/.codex/skills`、`~/.agents/skills`、`~/.codex/skills`；项目级优先，只有全局级命中时输出 WARN（`global-only`）。
- root 健康统一使用 `openspec doctor --json`；CLI 是否安装仍以 `openspec --version` 判定，skills 是否存在仍以文件系统扫描判定，`openspec doctor` 不承担 CLI 与 skills 检测。
- `lycx init` 默认采用只检查、不写当前项目的策略：输出与 `@lyx-init` 一致的诊断和建议动作，但不创建 `openspec/`、不安装项目级 skills；新增显式 `--init-openspec` 逃生口，只有用户主动传入时才执行项目级修复。
- `@lyx-init` 复用同一检查模型，并在检查后执行修复：CLI 缺失时安装；root 缺失时运行 `openspec init --tools codex`；root 存在但 required skills 在项目级与全局级均缺失时运行 `openspec update --force`（必要时回退 `openspec init --tools codex`）并复查；仅全局可用时输出 WARN 并继续，不自动固化到项目级。
- `lycx doctor` 复用同一检查模型展示 OpenSpec CLI、skills 解析来源、`global-only`/`missing` 状态与 root 健康结果，不执行修复。

## Capabilities

### New Capabilities


### Modified Capabilities

- `installer-preflight-checks`: 将单层“CLI + 任一 skill”检查升级为共享三层检查，明确 `lycx init` 默认 check-only、`--init-openspec`、`lycx doctor` 共用结果模型，以及 `global-only` WARN 语义。
- `ly-lifecycle-commands`: `@lyx-init` 改为复用共享 OpenSpec 依赖检查模型，并在检查后执行项目级修复与复查。

## Impact

- 影响 `src/utils/preflight.ts`、`src/cli-setup.ts`、`src/commands/init.ts`、`src/commands/doctor.ts`、i18n 文案与相关单元测试。
- 影响 `templates/skills-codex/init.md`（`@lyx-init` 编排说明）及对应安装产物行为。
- 影响 README/AGENTS/CLAUDE 等对外文档中的 OpenSpec 依赖检查描述。
- 不改变 `@lyx-apply`、`@lyx-review-code` 的本地 git diff/change 目录依赖；不引入自动 archive、不改变全自动流水线终止语义。
