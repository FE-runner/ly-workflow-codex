## Context

动机见 proposal.md。现状约束：

- 命令注册集中在 `src/utils/installer-data.ts` 的 `CORE_CONFIGS`，模板为 `templates/skills/<id>.md` 共享正文，经宿主适配层渲染（`@lyx-` → codex 原样 / claude `/lyx-`）；`{{HOST_FRAGMENT:*}}` 仅在宿主差异处使用。
- `commit-conventions` 把 `Change-Stage` 限定为五个取值且必须伴随 `Change-Name`；`@lyx-fix` 无 change 名。
- 测试以"模板文件集合 == 注册命令集合"做跨宿主不变量断言，并在 3 个测试文件中多处硬编码数量 14。

## Goals / Non-Goals

**Goals:**
- 一个命令完成小改动的全部闭环，单 commit 落地。
- spec 同步不靠自觉：分流是实施前的强制输出，自审②用实际 diff 复核。

**Non-Goals:**
- 不给主 spec 减重、不清理 `ly-wrapper` 等失效 spec（另起 change）。
- 不让 `@lyx-init` 自动生成「改动对称清单」初稿（后续按需追加）。
- 不新增配置字段；不引入 `Lyx-Flow` 之类新 trailer。

## Decisions

**D1 不创建 change，直接改主 spec。** 小改动用不上 delta → archive 的并行合并与方案审查价值；同一 commit 同改代码与主 spec，`git log -- openspec/specs/` 即可追溯。备选"propose lite 档"仍需 propose → apply → archive 三步，仪式减不下来，否决。

**D2 归入非 change 生命周期提交，不加 trailer。** 扩展 `Change-Stage` 取值会破坏"带 Change-Stage 必带 Change-Name"与审查定位逻辑；归入既有"非 change 生命周期"类别零侵入。区分 fix 提交与手工提交的需求暂不存在，不预加 trailer。

**D3 执行主体固定主 agent，不读宿主配置。** 轻流程不应再长出配置面；`reviewMode` 只门控 propose 编排，而 fix 的自审是轻流程唯一防漂移关卡，不应被 `off` 关掉。模板因此不需要 `{{LYX_CONFIG_FILE}}` 与宿主片段。

**D4 自审只查轻流程砍掉的风险。** 五项对应被省略的 proposal（①）、delta/归档（②）、design 影响面（③）、tasks 范围（④）、review-code 的测试检查（⑤）；通用维度在小 diff 上产出低，不纳入。

**D5 自审位置：测试变绿后、最终验证前。** 对稳定 diff 审才有意义；自审可能改代码，所以最终验证必须在最后一次编辑之后作为门禁。验证失败的修正只重跑③④，避免形成循环；连续 2 次失败转人工，与 apply"业务失败原样呈报"口径一致。

**D6 成对清单放在项目 AGENTS.md。** `@lyx-fix` 会安装到任意项目，成对关系是项目知识；约定小节标题固定为「改动对称清单」，缺失时退化为 agent 推断。本仓库补一份（zh-CN ↔ en、codex ↔ claude 片段、init ↔ menu、模板 ↔ 模板断言测试、命令变化 ↔ 文档命令表与计数）。

**D7 B 类才确认。** A 类风险低直接提交以保持轻；B 类等于未经审查改契约，提交前给用户看 spec diff。

**D8 注册分类。** 使用既有 `opsx` 分类、order 24（排在 archive 之后），不新增分类以免波及菜单分组；`fix` 不依赖 OpenSpec CLI（无 `openspec/specs/` 时降级为"无 spec 基线"），故不加入 `preflight.ts` 的 `DEPENDENT_COMMANDS`。

## Risks / Trade-offs

- [agent 把本应 C 的改动判成 B，绕过全流程] → C 的判定标准写入模板并要求写理由；B 类提交前用户确认 spec diff 兜底。
- [跳过方案审查导致 spec 改写质量下降] → 自审②复核 + B 类人工确认；必要时用户可事后对该 commit 跑 `@lyx-review-code`。
- [对称清单缺失时推断遗漏] → 推断须说明依据，便于用户发现漏项；本仓库提供清单。
- [B 类直接改主 spec 与进行中 change 的 delta 冲突] → 归档时 OpenSpec 合并会暴露冲突；分流规则把"相关 capability 存在进行中 delta"列为 C 判定条件。
