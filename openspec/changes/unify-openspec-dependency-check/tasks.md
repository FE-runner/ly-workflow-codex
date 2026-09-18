## 1. Shared OpenSpec Inspector

- [x] 1.1 在 `src/utils/preflight.ts` 定义 `OpenspecInspection`、`OpenspecAction`、CLI/skills/root 状态类型，并保留 `detectOpenspecCli()` 兼容导出；验证 `pnpm typecheck` 通过
- [x] 1.2 实现 `openspec config list --json` 读取与 workflow → skill 映射，失败时降级为默认 required 清单并标记 unknown；验证新增单测覆盖正常读取与失败降级
- [x] 1.3 实现多根 skills 扫描（`<project>/.agents/skills`、`<project>/.codex/skills`、`~/.agents/skills`、`~/.codex/skills`）、项目级优先、`project-ready`/`global-only`/`missing` 判定，其中 `global-only` 只 WARN 继续；验证单测覆盖全局-only、部分缺失、项目优先与 legacy 根
- [x] 1.4 实现 `openspec doctor --json` root 检查：无 root 映射 `root.missing`，不健康映射 `root.unhealthy`，健康映射 `root.healthy`；验证单测覆盖 no_openspec_root、healthy、unhealthy 三类 JSON
- [x] 1.5 实现 `inspectOpenspec()` 汇总状态与 `actions[]`，并实现 `ensureOpenspec()` 执行安装 CLI、init root、repair missing skills、复查 root；`global-only` 只 WARN 不修复；验证单测覆盖 check-only 不写项目与 ensure 修复路径

## 2. CLI 接入

- [x] 2.1 在 `src/cli-setup.ts` 新增 `lycx openspec inspect --json` 与 `lycx openspec ensure --json` 子命令，`inspect` 只读、`ensure` 支持 `--yes`；验证手动运行两个子命令输出 JSON 且 exit code 符合约定
- [x] 2.2 为 `lycx init` 增加 `--init-openspec` 选项：默认调用 `inspect` 并输出诊断，不写当前项目；带参数时调用 `ensure`；验证 `lycx init --help` 展示新选项
- [x] 2.3 改造 `checkExternalDeps()` 复用 `inspectOpenspec()`，按 `lycx init` 默认 check-only、`--init-openspec` ensure 的策略输出 CLI/skills/root 状态；验证既有 preflight 单测迁移后通过
- [x] 2.4 改造 `lycx doctor` 与 `lycx status` 的 OpenSpec 项复用 `inspectOpenspec()`，展示 `global-only`、missing skill 清单与 root 状态；验证 `lycx doctor` 在 project-ready/global-only/missing 三种状态下输出不同 detail

## 3. @lyx-init 模板

- [x] 3.1 更新 `templates/skills-codex/init.md` 步骤 2：优先调用 `lycx openspec ensure --yes --json`，`lycx` 不在 PATH 时回退 `npx -y ly-workflow-codex openspec ensure --yes --json`；验证模板中不再自行复制 workflow → skill 检测逻辑
- [x] 3.2 更新 `@lyx-init` 汇总与失败分支：ensure 失败时展示 JSON 中的 CLI/skills/root 状态、缺失 skill 清单与 `openspec doctor --json` fix 建议，并停止提交步骤；验证用缺失 skill 临时场景手动检查输出

## 4. 文案与文档

- [x] 4.1 更新 `src/i18n/index.ts` 的 preflight/doctor 文案，新增 `global-only` WARN、missing skill 清单、root missing/unhealthy、`--init-openspec` 提示；验证 `pnpm typecheck` 通过且中英文 key 对齐
- [x] 4.2 更新 `README.md`、`AGENTS.md`、`CLAUDE.md` 中 OpenSpec 依赖检查说明：三层检查、`global-only` WARN、`lycx init` 默认 check-only、`--init-openspec` 逃生口、`@lyx-init` 修复策略；验证文档不再描述“任一 openspec-* skill 存在即通过”

## 5. Verification

- [x] 5.1 运行 `pnpm typecheck`，确认无 TypeScript 错误
- [x] 5.2 运行 `pnpm test`，确认新增/迁移的 preflight、CLI、doctor 测试全部通过
- [x] 5.3 运行 `pnpm build`，确认 dist 产物构建成功
- [x] 5.4 手动验证三类真实状态：项目级 skills 齐备静默；仅全局 skills 输出 WARN；删除 `openspec-explore` 后 `lycx openspec inspect --json` 输出 missing 清单
