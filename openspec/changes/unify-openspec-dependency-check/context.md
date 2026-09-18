# Context: unify-openspec-dependency-check

## 关键决策

- 统一 OpenSpec 依赖检查为三层：CLI、skills、root。CLI 用 `openspec --version`；skills 用 `openspec config list --json` + 文件系统扫描；root 用 `openspec doctor --json`。
- `openspec doctor` 只作为 root 健康层，不替代 CLI/skills 检测，因为它本身需要 CLI，且不检查 `.agents/skills/openspec-*`。
- skills 检查按 OpenSpec workflow profile 推导 required skill，不再使用“任一 `openspec-*` 存在即通过”的 boolean 判定。
- skills 扫描项目级与全局级四类根：`<project>/.agents/skills`、`<project>/.codex/skills`、`~/.agents/skills`、`~/.codex/skills`；项目级优先。
- `global-only` 是合法可用状态：输出 WARN 后继续，不自动修复、不自动固化到项目级。
- `missing` 才是修复/阻断状态：root 存在时 `openspec update --force`，root 缺失时 `openspec init --tools codex`，必要时从 update 回退到 init。
- `lycx init` 默认只诊断，不写当前项目；显式 `lycx init --init-openspec` 才执行项目级修复。
- `@lyx-init` 复用共享检查/修复入口，负责项目级修复与复查。

## 已否决备选

- 完全统一 `lycx init` 与 `@lyx-init` 的处置：否决。用户明确不接受 `lycx init` 默认在当前目录创建 `openspec/`。
- 用 `openspec doctor` 作为总检查：否决。无法检测 CLI 缺失，也不检测 skills。
- 硬编码 required skill 清单：否决。OpenSpec profile 可配置，workflow 集可能变化。
- `@lyx-init` 直接复制 shell 检查/修复逻辑：否决。会与 TypeScript 检查器漂移，无法保证两个入口判定一致。

## 范围边界

- 不改变 `@lyx-apply` / `@lyx-review-code` 对项目内 change 目录与 git diff 的依赖。
- 不引入自动 archive。
- 不改变全自动 propose 流水线的终止语义。
- `lycx init` 默认不创建 `openspec/`、不安装项目级 skills、不运行 `openspec update --force`。
- `global-only` 不触发项目级写入，即使用户运行 `lycx init --init-openspec` 或 `@lyx-init`。

## 已知坑

- `openspec update --force` 在项目级 `.agents/skills` 完全缺失时可能报 “No configured tools found”；ensure 必须回退 `openspec init --tools codex`。
- `openspec doctor --json` 在无 root 时 exit code 为 1，JSON 状态为 `no_openspec_root`；应映射为 `root.missing`，不是 CLI 失败。
- `openspec config list --json` 失败时不能静默按空 required 清单通过；应降级为默认 required 清单并输出 unknown/WARN。
- `@lyx-init` 通过 `npx -y ly-workflow-codex ...` 回退时可能触发网络；优先使用 PATH 上的 `lycx`。
- 上游 `openspec` JSON 字段若变化，解析失败必须降级为 WARN/unknown，不能误判为通过。

## 讨论来源

- 用户删除 OpenSpec skills 后，`@lyx-propose` 无法委托 `@openspec-propose`，暴露当前 boolean 检查误判。
- 用户要求两个入口检查一致，但明确拒绝 `lycx init` 默认写当前项目的代价。
- 用户确认全局或项目任一位置有 skills 可用即可继续；仅全局可用时必须 WARN。
