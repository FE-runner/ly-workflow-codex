## Context

见 `proposal.md` 的 Why。当前全自动规则依赖文字“调用 `@lyx-review-plan` / `@lyx-apply` / `@lyx-review-code`”，但 Codex 的 skill 内容由用户 mention 注入，模型没有通用 `invoke_skill` 工具。现有 `src/evals/cases.ts` 每个 case 只安装一个 skill，propose 场景只验证在第一个隔离询问处停止，因此“阶段报告后继续”一直没有被真实执行覆盖。

## Goals / Non-Goals

**Goals:**

- 让每个全自动阶段都有可执行、可恢复的下一阶段动作。
- 在 Codex 与 Claude Code 的全局 / 项目级安装位置下复用同一套相对路径语义。
- 用真实多阶段 fixture 证明 review-plan 正常清零后会实际进入 apply 和 review-code。

**Non-Goals:**

- 不引入 wrapper、外部 orchestrator、后台守护进程或新的用户命令。
- 不改变 `reviewMode` 门控、审查终止条件、commit 规范或人工介入规则。
- 不把全自动连续性评测加入普通 `pnpm test` 或默认 CI。
- 不自动 archive。

## Decisions

**D1：用同级 skill bundle，而不是绝对安装路径或“再次 mention”。**
当前已加载的 `lyx-propose` / `lyx-review-plan` / `lyx-apply` 位于 `<skills-root>/lyx-<command>/SKILL.md`，下一阶段可由 `../lyx-<next-command>/SKILL.md` 定位。该写法同时适用于 Codex 的 `~/.agents/skills`、Claude Code 的 `~/.claude/skills` 和评测项目的 `.agents/skills`。
备选（已否决）：在模板中写死 codex / claude 全局路径——迁移、项目本地安装和评测 fixture 会失效。备选（已否决）：再次输出 `@lyx-apply` 等待宿主处理——模型输出不是用户 mention，无法保证注入下一 skill。备选（已否决）：shell 调用 `codex exec` 继续阶段——违反本项目无 wrapper / 外部编排的边界。

**D2：交接动作由“阶段 bundle 读取”与“业务执行”两部分组成。**
进入下一阶段时，主 agent 必须先完整读取同级主 `SKILL.md`，再按 frontmatter 的 `references:` 读取全部 references，之后才执行该阶段。读取主文件但跳过 references、或仅口头宣告下一命令，都不算完成交接。

**D3：把最小交接锚点放在 propose、review-plan、apply 主文件。**
三份主文件分别直接写明下一阶段为 review-plan、apply、review-code。rules 的完整细节仍在 sidecar；主文件只增加约数行“同级路径 + 主文件与 references 全读 + 命令标识不算执行”。`review-code` 是正常终态，不新增下一阶段。
备选（已否决）：只放 references——上下文压缩或主文件单独重挂时会丢失关键续跑规则。

**D4：`run-state.md` 仍使用自由文本，不新增 YAML 字段。**
现有 `下一步安全动作` 已随 change 提交并可跨回合恢复。实现把它强化为包含“下一阶段命令 + 同级 skill 路径 + 参数 + 继续条件”的一段固定句式，不改变文件格式或 OpenSpec schema。
备选（已否决）：新增结构化 `nextStage` 对象——需要引入 YAML 读取与兼容规则，收益不足以抵消复杂度。

**D5：评测 case 从“一 case 一 skill”扩展为“一 case 可安装多 skill”。**
`cases.ts` 保留现有 `EvalSkill` 作为 skill 命令类型，但把可执行 case 标识扩展为独立字符串类型，并给 case 增加 `skillCommands: EvalSkill[]`。`run-skill-evals.ts` 按该数组安装全部 bundle；默认 `--case` 仍只包含现有四个基础场景，连续性场景通过显式 case 名运行，避免改变既有 8 单元默认套件。
备选（已否决）：复用当前 propose case 改成多阶段——会丢失“非交互首问”场景。备选（已否决）：在 runner 外写一次性脚本——无法形成仓库内可审计评测。

**D6：新增显式 `propose-full-auto` case，从 review-plan 中途恢复。**
fixture 预置合法 change、propose 阶段 commit、`执行模式: full-auto` 的 run-state 和可实施 tasks，prompt 直接触发 `@lyx-review-plan eval-change`。review-plan 正常清零后必须继续 apply；apply 创建简单源码与测试并提交 `Change-Stage: apply`；随后必须继续 review-code 并正常结束。副作用检查验证 tasks 勾选、apply commit、代码/测试文件和正常终态文本均存在。
该 case 不进入默认四场景套件；文档给出显式命令，保持既有“四个基础场景 × baseline/current = 8 单元”的审计口径。
备选（已否决）：fixture 只检查最终文本出现 “apply”——无法证明实际执行。备选（已否决）：只验证 review-plan→apply 一跳——仍可能漏掉 apply→review-code 的第二处交接。

## Risks / Trade-offs

- **主 skill 文件体积上升** → 每处只保留数行交接锚点，现有 20,000 字节上限测试继续守护；完整规则仍在 references。
- **同级路径解析依赖当前 skill 路径已知** → 模板使用 `<skills-root>` 相对描述，并在无法定位时停止报告，不回退到猜测绝对路径。
- **多阶段评测耗时与模型随机性** → 场景使用简单 tasks 与固定无 Critical 的 fixture；真实执行仍需显式 `pnpm eval:skills`，失败标 `failed`，环境问题标 `not-executed`。
- **Claude Code 可通过 Skill 工具调用同名 skill** → 读取同级 bundle 的通用动作仍适用；实现不得硬编码 Codex 专有工具名。
- **历史会话 run-state 没有新句式** → 恢复时识别为信息不足，从当前阶段和 `reviewMode` 重建下一动作，不修改已完成阶段结论。

## Migration Plan

- 无数据迁移、配置字段或 schema 变更。
- 合并并发布后，用户执行 `lycx update` 重装 skill bundle；未更新的副本继续旧行为。
- 回滚时还原三份主 skill、相关 references、评测 runner/case 与契约测试即可。
