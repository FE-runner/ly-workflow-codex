## 1. Skill 行为评测资产

- [ ] 1.1 新增 `docs/skill-behavior-evals.md`，说明基线/修改后证据、压力场景格式和未执行标注规则；运行 `rg -n "基线|修改后|未执行|禁止动作" docs/skill-behavior-evals.md` 确认关键字段存在
- [ ] 1.2 在 `evals/skills/` 为 `propose`、`apply`、`review-plan`、`review-code` 各新增至少一个 Markdown 场景，包含前置状态、用户请求、必须动作、禁止动作、通过条件和证据记录区；运行 `find evals/skills -name '*.md' | wc -l` 确认至少 5 个文件
- [ ] 1.3 新增 `src/utils/__tests__/skill-evals.test.ts` 断言四个核心 skill 都有场景且字段完整；运行 `pnpm test -- src/utils/__tests__/skill-evals.test.ts` 并确认通过

## 2. Skill references 安装基础

- [ ] 2.1 扩展 `HostTemplateTarget` 与 `installCommandFiles`，支持从 `templates/skill-references/<command>/` 渲染并复制 Markdown 到目标 `references/`，无 sidecar 的既有 skill 保持原行为；运行 `pnpm typecheck` 确认接口改动完整
- [ ] 2.2 为 codex 与 claude adapter 提供 references 源路径，确保宿主 fragments、`{{LYX_CONFIG_FILE}}` 与调用前缀在 references 中同样渲染；运行 `pnpm test -- src/utils/__tests__/installer.test.ts` 确认双宿主安装
- [ ] 2.3 在 `package.json.files` 登记 `templates/skill-references/`，扩展 packaging 测试覆盖 references；运行 `pnpm test -- src/utils/__tests__/packaging.test.ts` 确认无遗漏或陈旧条目
- [ ] 2.4 增加安装失败校验：源 sidecar 文件存在但目标写入失败、或主文件声明 required reference 缺失时如实报错；用临时目录测试覆盖并运行 installer 测试

## 3. 拆分超长核心模板

- [ ] 3.1 从 `templates/skills/review-plan.md` 抽出判级与循环/终止细节到 `templates/skill-references/review-plan/review-loop.md`，主文件保留目标解析、路径枚举、阶段入口和 reference 读取指令；验证双宿主渲染后的 `SKILL.md` 小于 20,000 字节
- [ ] 3.2 从 `templates/skills/review-code.md` 抽出判级、修复循环、驳回/熔断与提交细节到对应 `templates/skill-references/review-code/review-loop.md`，主文件保留目标和范围入口；验证双宿主渲染大小
- [ ] 3.3 从 `templates/skills/propose.md` 抽出隔离/提交协议和自动流水线细节到 `templates/skill-references/propose/` 下至少两个文件，主文件保留询问顺序、change 名解析、自审入口和 reference 读取条件；验证双宿主渲染大小
- [ ] 3.4 收缩 `propose`、`review-plan`、`review-code` 的 frontmatter description 为触发条件，不概括执行流程；运行 host-adapters 测试并确认 description 断言更新

## 4. 长模板测试与打包

- [ ] 4.1 扩展 `src/utils/__tests__/host-adapters.test.ts`：断言三个核心 skill 的双宿主渲染 `SKILL.md` `< 20000` 字节、主文件引用的 references 均在源目录存在、description 不含完整流程摘要关键词
- [ ] 4.2 扩展 installer 测试：带 references 的 skill 安装后存在 `references/`，宿主差异片段已渲染，force 更新会移除陈旧 reference，非 references skill 不受影响
- [ ] 4.3 更新 doctor/verify 检查以报告主文件或 required reference 缺失；运行 `pnpm test -- src/commands/__tests__/host-ops.test.ts` 确认双宿主行为

## 5. Run state 生命周期

- [ ] 5.1 在 `templates/skills/propose.md` 与 propose references 中加入固定 `run-state.md` 结构、初始化条件和 propose commit 纳入规则；运行模板断言确认 Change/Stage/Next safe action 字段存在
- [ ] 5.2 在 `apply.md` 中加入任务/验证证据、机械裁决和阶段转换更新规则，并把 `run-state.md` 纳入 apply commit 文件清单校验；运行 host-adapters 与 installer 相关测试
- [ ] 5.3 在 `review-plan.md`、`review-code.md` 中加入启动/每轮读取 run-state、git 事实核对、审查轮次和终止类型写回规则；验证主文件仍低于 20,000 字节
- [ ] 5.4 在 `archive.md` 中加入最终验证证据写入、archive-ready 阶段更新和归档 commit 纳入规则；运行 `pnpm test -- src/utils/__tests__/host-adapters.test.ts`
- [ ] 5.5 新增 run-state 模板测试：断言 `context.md` 与 run-state 的职责边界、禁止敏感内容、恢复冲突以 git/files 为准

## 6. 计划实施就绪检查

- [ ] 6.1 在 propose 自审中加入文件/锚点、接口、验证命令、预期结果、独立交付边界五项实施就绪检查；运行模板断言确认五项均出现在机械断链规则中
- [ ] 6.2 在 review-plan 的判级/reference 中加入实施可执行性审查，要求跨模块接口缺失判影响落地且不可机械自动修复；运行 review 模板测试

## 7. 系统调试与证据化完成

- [ ] 7.1 在 `fix.md` 的 bug 分支加入根因调查、单假设验证、连续 3 次失败后质疑架构的规则；运行 fix 模板断言
- [ ] 7.2 在 apply、fix、review、archive 的输出要求中加入“命令 + 退出码 + 结果摘要”的新鲜证据格式，并明确 subagent 自报成功需核对 diff/文件清单；运行 host-adapters 断言

## 8. 文档与规格同步

- [ ] 8.1 更新 `AGENTS.md`、`CLAUDE.md`、`templates/CLAUDE.md`、README 双语：说明 skill references、行为评测、run-state、实施就绪和证据规则，不改变命令数量
- [ ] 8.2 更新相关主 spec 的 Purpose/Requirement 仅在归档时由 OpenSpec 合并，本次检查 delta 路径与 proposal 的 Capabilities 逐项一致；运行 `openspec validate --changes adopt-superpowers-process-practices`
- [ ] 8.3 更新 `CHANGELOG.md` 的 `[Unreleased]`，记录新增流程可靠性能力；运行 `rg -n "skill references|run-state|行为评测|实施就绪|系统调试" CHANGELOG.md`

## 9. 完整验证

- [ ] 9.1 运行 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`，全部通过后记录命令、退出码和摘要到 run-state
- [ ] 9.2 运行 `openspec validate --all --json`，确认全部 change/spec 合法；失败则修复并重跑
- [ ] 9.3 检查安装产物体积与结构：双宿主渲染后的 `propose`、`review-plan`、`review-code` `SKILL.md` 均小于 20,000 字节，references 全部存在；记录最终 evidence
