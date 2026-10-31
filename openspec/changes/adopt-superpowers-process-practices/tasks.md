## 1. Skill 行为评测资产

- [ ] 1.1 新增 `docs/skill-behavior-evals.md`，说明基线/修改后证据、压力场景格式和未执行标注规则；运行 `rg -n "基线|修改后|未执行|禁止动作" docs/skill-behavior-evals.md`，预期四类关键词均命中且命令 exit 0
- [ ] 1.2 新增 `evals/skills/README.md` 与 `evals/skills/propose.md`、`evals/skills/apply.md`、`evals/skills/review-plan.md`、`evals/skills/review-code.md`，每个场景包含前置状态、用户请求、必须动作、禁止动作、通过条件和证据记录区；运行 `test -f evals/skills/README.md && test -f evals/skills/propose.md && test -f evals/skills/apply.md && test -f evals/skills/review-plan.md && test -f evals/skills/review-code.md`，预期 exit 0
- [ ] 1.3 新增 `src/utils/__tests__/skill-evals.test.ts` 断言四个核心 skill 场景文件和字段完整；运行 `pnpm test -- src/utils/__tests__/skill-evals.test.ts`，预期全部通过
- [ ] 1.4 在修改核心 skill 前，按 `evals/skills/` 对 `propose`、`apply`、`review-plan`、`review-code` 运行基线场景，按 `- <skill>: passed|failed|not-executed — <summary>` 记录到 `run-state.md` 的 `Baseline Eval` 小节；运行 `for s in propose apply review-plan review-code; do awk '/^## Baseline Eval$/{f=1;next}/^## /{f=0}f' openspec/changes/adopt-superpowers-process-practices/run-state.md | rg -q "^- $s: (passed|failed|not-executed) — " || exit 1; done`，预期 exit 0

## 2. Skill references 安装基础

- [ ] 2.1 扩展 `HostTemplateTarget` 与 `installCommandFiles`：解析主 `SKILL.md` frontmatter 的 `references:` 列表，从 `templates/skill-references/<command>/` 渲染并复制到目标 `references/`，force 更新按当前列表删除 stale reference，无列表的既有 skill 保持原行为；运行 `pnpm typecheck`，预期 exit 0
- [ ] 2.2 为 `src/hosts/codex/adapter.ts` 与 `src/hosts/claude/adapter.ts` 提供 references 源路径，确保宿主 fragments、`{{LYX_CONFIG_FILE}}` 与调用前缀在 references 中同样渲染；运行 `pnpm test -- src/utils/__tests__/installer.test.ts`，预期双宿主安装通过
- [ ] 2.3 在 `package.json.files` 登记 `templates/skill-references/`，扩展 `src/utils/__tests__/packaging.test.ts` 覆盖 references；运行 `pnpm test -- src/utils/__tests__/packaging.test.ts`，预期无遗漏或陈旧条目
- [ ] 2.4 增加安装失败校验：源 sidecar 文件存在但目标写入失败、或主文件 `references:` 列表声明的 required reference 缺失时如实报错；新增临时目录用例并运行 `pnpm test -- src/utils/__tests__/installer.test.ts`，预期通过

## 3. 拆分超长核心模板

- [ ] 3.1 从 `templates/skills/review-plan.md` 抽出判级与循环/终止细节到 `templates/skill-references/review-plan/review-loop.md`，主文件保留目标解析、路径枚举、阶段入口和 reference 读取指令；运行 `pnpm test -- src/utils/__tests__/host-adapters.test.ts`，预期双宿主渲染后的 `SKILL.md` 小于 20,000 字节
- [ ] 3.2 从 `templates/skills/review-code.md` 抽出判级、修复循环、驳回/熔断与提交细节到 `templates/skill-references/review-code/review-loop.md`，主文件保留目标和范围入口；运行 `pnpm test -- src/utils/__tests__/host-adapters.test.ts`，预期双宿主渲染大小断言通过
- [ ] 3.3 从 `templates/skills/propose.md` 抽出隔离/提交协议和自动流水线细节到 `templates/skill-references/propose/` 下至少两个文件，主文件保留询问顺序、change 名解析、自审入口和 reference 读取条件；运行 `pnpm test -- src/utils/__tests__/host-adapters.test.ts`，预期双宿主渲染大小断言通过
- [ ] 3.4 收缩 `propose`、`review-plan`、`review-code` 的 frontmatter description 为触发条件；运行 `pnpm test -- src/utils/__tests__/host-adapters.test.ts`，预期固定禁止片段 `审查-修复循环`、`终止条件`、`提交顺序`、`自动流水线`、`reviewExecutor`、`spawn` 均不存在
- [ ] 3.5 按同一四个评测场景对修改后的核心 skill 做阶段复跑，按 `- <skill>: passed|failed|not-executed — <summary>` 记录到 `run-state.md` 的 `Modified Eval (intermediate)` 小节；运行 `for s in propose apply review-plan review-code; do awk '/^## Modified Eval \(intermediate\)$/{f=1;next}/^## /{f=0}f' openspec/changes/adopt-superpowers-process-practices/run-state.md | rg -q "^- $s: (passed|failed|not-executed) — " || exit 1; done`，预期 exit 0

## 4. 长模板测试与打包

- [ ] 4.1 扩展 `src/utils/__tests__/host-adapters.test.ts`：断言三个核心 skill 的双宿主渲染 `SKILL.md` `< 20000` 字节、frontmatter 中每个 reference 均在源目录存在、固定禁止片段不进入 description；运行该测试，预期通过
- [ ] 4.2 扩展 `src/utils/__tests__/installer.test.ts`：带 `references:` 的 skill 安装后存在目标 references，宿主差异片段已渲染，force 更新会移除陈旧 reference，无列表 skill 不受影响；运行该测试，预期通过
- [ ] 4.3 更新 `src/hosts/codex/adapter.ts`、`src/hosts/claude/adapter.ts` 与 `src/hosts/codex/doctor.ts`、`src/hosts/claude/doctor.ts`，按 frontmatter 列表报告主文件或 required reference 缺失；运行 `pnpm test -- src/commands/__tests__/host-ops.test.ts`，预期双宿主通过

## 5. Run state 生命周期

- [ ] 5.1 在 `templates/skills/propose.md` 与 propose references 中加入固定 `run-state.md` 结构、`Completed tasks: <done>/<total>`、初始化条件和 propose commit 纳入规则；运行 `pnpm test -- src/utils/__tests__/host-adapters.test.ts`，预期 Change/Stage/Next safe action/Completed tasks 字段断言通过
- [ ] 5.2 在 `templates/skills/apply.md` 中加入启动恢复：先读 run-state，再核对 `git status`、`git log`、tasks 与目标文件；加入任务/验证证据、机械裁决、阶段转换更新和 apply commit 清单校验；运行 `pnpm test -- src/utils/__tests__/host-adapters.test.ts src/utils/__tests__/installer.test.ts`，预期通过
- [ ] 5.3 在 `templates/skills/review-plan.md`、`templates/skills/review-code.md` 及对应 references 中加入启动/每轮读取 run-state、git 事实核对、审查轮次和终止类型写回规则；运行 `pnpm test -- src/utils/__tests__/host-adapters.test.ts`，预期主文件仍低于 20,000 字节
- [ ] 5.4 在 `templates/skills/archive.md` 中加入启动恢复核对、final testMode 及来源、最终验证证据写入、archive-ready 阶段更新和归档 commit 纳入规则；运行 `pnpm test -- src/utils/__tests__/host-adapters.test.ts`，预期字段断言通过
- [ ] 5.5 新增 `src/utils/__tests__/run-state.test.ts`：断言 `context.md` 与 run-state 的职责边界、禁止敏感内容、恢复冲突以 git/files 为准、统一提交后回填 SHA；运行 `pnpm test -- src/utils/__tests__/run-state.test.ts`，预期通过

## 6. 计划实施就绪检查

- [ ] 6.1 在 `templates/skills/propose.md` 与 propose references 中加入文件/锚点、接口、验证命令、预期结果、独立交付边界五项实施就绪检查；运行 `pnpm test -- src/utils/__tests__/host-adapters.test.ts`，预期五项均出现在机械断链规则中
- [ ] 6.2 在 `templates/skill-references/review-plan/review-loop.md` 中加入实施可执行性审查，要求跨模块接口缺失判影响落地且不可机械自动修复；运行 `pnpm test -- src/utils/__tests__/host-adapters.test.ts`，预期 review 模板断言通过

## 7. 系统调试与证据化完成

- [ ] 7.1 在 `templates/skills/fix.md` 的 bug 分支加入根因调查、单假设验证、连续 3 次失败后质疑架构的规则；运行 `pnpm test -- src/utils/__tests__/host-adapters.test.ts`，预期 fix 模板断言通过
- [ ] 7.2 在 apply、fix、review、archive 的输出要求中加入“命令 + 退出码 + 结果摘要”的新鲜证据格式，并明确 subagent 自报成功需核对 diff/文件清单；运行 `pnpm test -- src/utils/__tests__/host-adapters.test.ts`，预期新鲜证据与 subagent 核对断言通过

## 8. 文档与规格同步

- [ ] 8.1 更新 `AGENTS.md`、`CLAUDE.md`、`templates/CLAUDE.md`、`README.md`、`README.zh-CN.md`：说明 skill references、行为评测、run-state、实施就绪和证据规则，不改变命令数量；运行 `rg -n "skill references|run-state|行为评测|实施就绪|系统调试" AGENTS.md CLAUDE.md templates/CLAUDE.md README.md README.zh-CN.md`，预期关键说明出现
- [ ] 8.2 检查 delta spec 路径与 proposal 的 Capabilities 逐项一致；主 spec 只在归档时由 OpenSpec 合并，本次运行 `openspec validate --changes adopt-superpowers-process-practices`，预期 1/1 valid
- [ ] 8.3 更新 `CHANGELOG.md` 的 `[Unreleased]`，记录新增流程可靠性能力；运行 `rg -n "skill references|run-state|行为评测|实施就绪|系统调试" CHANGELOG.md`，预期关键条目命中

## 9. 完整验证

- [ ] 9.1 运行 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`，全部通过后记录命令、退出码和摘要到 run-state
- [ ] 9.2 运行 `openspec validate --all --json`，确认全部 change/spec 合法；失败则修复并重跑
- [ ] 9.3 运行 `pnpm test -- src/utils/__tests__/host-adapters.test.ts src/utils/__tests__/installer.test.ts`，预期双宿主下 `propose`、`review-plan`、`review-code` 渲染 `SKILL.md` 小于 20,000 字节、声明的 references 全部存在且安装结构断言通过；记录最终 evidence
- [ ] 9.4 按最终模板复跑四个核心 skill 的全部受影响行为评测场景，按 `- <skill>: passed|failed|not-executed — <summary>` 写入 `run-state.md` 的 `Modified Eval (final)` 小节；运行 `for s in propose apply review-plan review-code; do awk '/^## Modified Eval \(final\)$/{f=1;next}/^## /{f=0}f' openspec/changes/adopt-superpowers-process-practices/run-state.md | rg -q "^- $s: (passed|failed|not-executed) — " || exit 1; done`，预期 exit 0；3.5 的早期证据 SHALL NOT 替代本任务
