## 1. 配置层

- [x] 1.1 在 `src/types/index.ts` 的 `codexHost` 中新增 `reviewExecutor` / `codingExecutor` 可选字段（类型 `'main' | 'subagent'`），移除 `reviewModelB` / `reviewReasoningEffortB`；跑 `pnpm typecheck` 确认类型定义自洽
- [x] 1.2 在 `src/utils/config.ts` 新增执行者字段清洗（trim，仅接受 `main` / `subagent`，其余视为未配置），在 `createDefaultConfig` 与 `sanitizeCodexHostExtras` 中支持两个执行者字段并移除两个弃用字段；更新 `src/utils/__tests__/config.test.ts` 覆盖默认值、非法值、保留逻辑并跑通
- [x] 1.3 更新 `src/utils/__tests__/injectConfigVariables.test.ts` 等配置相关测试，确认移除弃用字段后无残留断言且全部通过

## 2. 安装器与模板渲染

- [x] 2.1 更新 `src/utils/host-adapters.ts` 的 `HostAdapterConfig`（新增执行者字段、移除 `reviewModelB` 透传）；跑 `pnpm vitest run src/utils/__tests__/host-adapters.test.ts`
- [x] 2.2 更新 `src/utils/installer-data.ts` 中 review-plan / review-code 的描述（去掉"双审查 subagent"，改为执行者可切换）；跑 `pnpm vitest run src/utils/__tests__/installer.test.ts`
- [x] 2.3 检查 `src/utils/installer-template.ts`、`src/utils/installer.ts` 中对弃用字段的引用并移除，跑 `pnpm typecheck` 确认无残留引用

## 3. init 向导与菜单

- [x] 3.1 更新 `src/commands/init.ts`：新增执行者二连采集（候选"主 agent 直接执行" / "spawn 独立子代理"），模型采集按执行者条件触发，摘要标注不生效字段；更新对应测试并跑通
- [x] 3.2 更新 `src/commands/menu.ts` 的"修改审查模型"入口，支持执行者字段编辑并保留其余字段；跑 `pnpm vitest run src/commands/__tests__/menu.test.ts`
- [x] 3.3 更新 `src/i18n/index.ts`（zh-CN / en）新增执行者相关文案、移除弃用字段文案；跑 `pnpm typecheck`

## 4. doctor

- [x] 4.1 更新 `src/commands/doctor.ts` 的 `assessSubagentModelConfig`：展示两个执行者字段、执行者为 `main` 时对非空模型 / 推理档字段输出 WARN、非法执行者取值 WARN 并按 `main` 处理、提示弃用字段已移除；跑 `pnpm vitest run src/commands/__tests__/doctor.test.ts`

## 5. 命令模板

- [x] 5.1 更新 `templates/skills-codex/review-plan.md`：加入执行者分支（`main` 直接自审、最多 2 轮、无逐条裁决与驳回硬线；`subagent` 复用同一子代理）、移除每轮慢验证、废止"回合结束即失去访问能力"表述，并确认模板内不再出现 `reviewModelB`
- [x] 5.2 更新 `templates/skills-codex/review-code.md`：同 5.1 的执行者分支，删除 3.3 本轮验证与终止条件 4 中的测试 / 类型检查 / 构建，保留 `openspec validate` 之外既有规则
- [x] 5.3 更新 `templates/skills-codex/apply.md`：加入 `codingExecutor` 分支（`main` 直接实施 / `subagent` spawn），统一提交与快照核对规则覆盖两条路径
- [x] 5.4 更新 `templates/skills-codex/archive.md`：加入归档前完整验证前置步骤（测试 / 类型检查 / 构建，缺失项跳过并注明），验证失败阻断归档
- [x] 5.5 更新 `templates/skills-codex/propose.md` 的全自动流水线说明，使其按执行者语义衔接并引用新的验证时机，删除对"单审查 subagent 机制"的硬编码表述

## 6. 文档

- [x] 6.1 更新 `README.md` 与 `CLAUDE.md`：执行者字段、默认 `main`、验证时机、`reviewModelB` 移除
- [x] 6.2 更新 `AGENTS.md` 与 `templates/CLAUDE.md` 的对应章节
- [x] 6.3 重写 `workflow.md` 流程图为单审 / 可切换执行者版本，清理其中过时的 `codex exec` 双审查与 `session_id` 内容
- [x] 6.4 更新 `CHANGELOG.md` 新增条目（破坏性变更与升级迁移说明）
- [x] 6.5 从 `.gitignore` 移除 `/AGENTS.md`，使根 `AGENTS.md` 纳入版本控制（工程配置调整，无 spec 级行为变化）

## 7. 集成验证

- [x] 7.1 跑 `pnpm typecheck && pnpm build && pnpm test` 全绿
- [x] 7.2 跑 `pnpm dev doctor`（或安装后的 `lycx doctor`）确认执行者字段展示与 WARN 逻辑符合预期
- [x] 7.3 跑 `openspec validate --changes switchable-executor-flow` 确认本 change 的 artifacts 结构合法
