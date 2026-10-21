## 1. preflight：outside-project

- [ ] 1.1 `src/utils/preflight.ts` 的 root 状态类型新增 `outside-project`；doctor healthy 后按项目顶层（git toplevel，失败用 cwd）校验 `root.path`，越界即判 `outside-project`；以单测覆盖家目录 root / 项目内 root
- [ ] 1.2 `ensureOpenspec` 把 `outside-project` 与 `missing` 同等对待（allowWrite 时执行 `init-root`，执行后重新检查）；以单测覆盖"可写修复"与"只读报告"两条
- [ ] 1.3 `printOpenspecInspection` 为 `outside-project` 输出红色错误、root 路径与项目顶层、并给 `openspec init` 指引
- [ ] 1.4 `src/i18n/index.ts` 增补 zh-CN / en 对应文案键

## 2. 模板：explore / propose / init

- [ ] 2.1 `templates/skills/explore.md` 顶部扫描改为 `find ... -maxdepth 2 -name review-findings.md`，移除 `ls` glob
- [ ] 2.2 `templates/skills/propose.md` 隔离询问前增加 `git rev-parse --verify HEAD` 检查，无提交时禁用/标注隔离 worktree 并说明需 baseline commit
- [ ] 2.3 `templates/skills/propose.md` 的 WIP commit 文案按路径参数化（切新分支 / 留在当前分支两套首行）
- [ ] 2.4 `templates/skills/init.md` 步骤 2 增加 root.path 必须位于仓库顶层之下的校验，并写明「先 openspec init、再 ensure」的规范顺序与各自产物

## 3. 断言与文档

- [ ] 3.1 `host-adapters.test.ts` 增加模板断言：explore 使用 `find`、propose 含 unborn HEAD 检查与两套 WIP 文案、init 含 root 位置校验
- [ ] 3.2 同步 `AGENTS.md` 的 preflight / init 行为描述（如与新状态冲突）
- [ ] 3.3 全量验证：`pnpm test`、`pnpm typecheck`、`pnpm build`、`openspec validate --changes fix-workflow-issues-2026-10`
