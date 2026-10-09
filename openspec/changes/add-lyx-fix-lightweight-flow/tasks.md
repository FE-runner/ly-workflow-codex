## 1. 命令注册与模板

- [ ] 1.1 在 `src/utils/installer-data.ts` 的 `CORE_CONFIGS` 注册 `cmd('fix', 24, 'opsx', ...)`（中英文名称与描述），验证 `getAllCommandIds()` 含 `fix`
- [ ] 1.2 新增 `templates/skills/fix.md`（frontmatter 含 `name: lyx-fix` / `description` / `argument-hint`），正文按 `lightweight-fix-flow` 写全：预存改动检查、A/B/C 分流（含 C 判定条件、用户坚持、无 spec 基线）、先红后绿回归测试、五项自审（含读取 AGENTS.md「改动对称清单」与缺失推断）、最终验证门禁与连续失败转人工、B 类确认、单 commit 约定（按路径暂存、正文六条 bullet、无 Change trailer）；不使用宿主片段与配置变量；验证两宿主渲染无残留 `{{` 占位
- [ ] 1.3 修改 `templates/skills/explore.md` 收敛提示为按规模分流（小改动提示 `@lyx-fix`，其余提示 `@lyx-propose`，均不自动执行），验证两宿主渲染结果中前缀改写正确

## 2. 测试

- [ ] 2.1 将 `host-adapters.test.ts`、`installer.test.ts`、`host-ops.test.ts` 中的 skill 数量断言 14 → 15（含用例标题与注释），运行相关测试通过
- [ ] 2.2 在 `host-adapters.test.ts` 新增 fix 模板不变量断言：含 A/B/C 分流、五项自审、「改动对称清单」、无 `Change-Stage` trailer 约定、不读取 `reviewExecutor`；先运行确认失败再补模板使其通过
- [ ] 2.3 新增 explore 收敛提示断言（同时含 `@lyx-fix` 与 `@lyx-propose` 提示，按宿主前缀改写），运行通过

## 3. 文档

- [ ] 3.1 AGENTS.md：命令注册/模板计数 14 → 15、命令表与设计决策补 `@lyx-fix`，新增「改动对称清单」小节（zh-CN ↔ en 文案键、codex ↔ claude 宿主片段、init ↔ menu 配置入口、模板正文 ↔ 模板断言测试、命令增删 ↔ 文档命令表与计数）；验证 `grep -n "14 个" AGENTS.md` 无残留
- [ ] 3.2 同步 CLAUDE.md、README.md、README.zh-CN.md、`templates/CLAUDE.md` 的计数与命令表，CHANGELOG `Unreleased` 记录新增命令；验证上述文件 `grep -nE "14 (个|skills|\`)"` 无残留

## 4. 整体验证

- [ ] 4.1 运行 `pnpm typecheck && pnpm test` 全绿，`openspec validate --changes add-lyx-fix-lightweight-flow` 通过
