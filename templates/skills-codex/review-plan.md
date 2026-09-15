---
name: lyx-review-plan
description: '读取 OpenSpec change 的 proposal/design/tasks，双审查 subagent（fork 当前会话上下文，模型按 reviewModel/reviewModelB 分别指定）分级审查方案合理性，审查-修复循环直到 Critical 清零或触发终止条件'
argument-hint: '[<change-name>] [--no-commit]'
---

<!-- 双审查 subagent 执行约定（spawn 协议、任务构造、共识/分歧裁决）内联于本文件，无外部 shell 调用契约；
     模型指定经"模板指示 + 宿主能力"落实，见"步骤 3"与模板变量说明 -->

# Review Plan - 方案审查

> 调用方式：`@lyx-review-plan` mention 后跟随的自然语言即参数（如 `@lyx-review-plan` 带需求描述/选项）；无参数时直接 `@lyx-review-plan`。

审查当前 OpenSpec change 的方案是否合理，聚焦遗漏边界、范围不清晰、风险点——不是逐行代码风格。输出 Critical/Warning/Info 分级结果（与 `@lyx-review-code` 一致）。若存在 Critical，进入审查-修复循环：当前会话判断是否认可每条 Critical，认可则修改该 change 的 artifact 并自动重新审查，直到清零或触发终止条件。

审查由 **2 个并行审查 subagent** 执行（subagent 多 Agent 模式）：每个 subagent fork 当前会话上下文（关键决策、取舍、已知边界等软上下文不丢失），任务中点名"只审该 change 的产物范围"；模型按 `codexHost.reviewModel`（agent A）/ `codexHost.reviewModelB`（agent B）分别指定，未配置或空白时继承当前会话模型。两 agent 各自独立审查 → 交换结论 → 达成共识；意见分歧时主会话拍板并显式提示用户，主会话不能确认 → 判定 Critical。Critical 判定/修复由当前会话执行。

循环执行期间默认不提交；仅当循环以"正常清零"结束时，才对审查目标全部文件（该 change 的 artifact 与 delta spec，含编排方已暂存的产物与循环修复）统一提交一次（见步骤 5）。传入 `--no-commit` 时，连这次最终的统一提交也不做。

## 步骤

### 1. 解析目标 change

按优先级：

1. 若 `参数` 指定了 change 名称 → 使用该名称
2. 否则枚举 `openspec/changes/` 下的目录，**排除 `archive/` 目录及其内容**
3. 若恰好一个候选 → 直接使用
4. 若多个候选且未指定 → 直接询问用户选哪个
5. 若零个候选 → 询问用户要审查哪个 change，不要猜测

```bash
ls -d openspec/changes/*/ 2>/dev/null | grep -v '/archive/'
```

审查对象是目标 change 的 `propose:` commit（编排方 `@lyx-propose` 在生成方案后立即提交，提交信息 `propose: <change-name>`）。审查基线 SHALL 用 `git log --grep="^propose: <change-name>"` 取 HEAD 侧最近一期匹配 commit，审查范围 = 该 commit 差异（`git show <commit>`）+ 当前 `git diff HEAD` + 未跟踪文件清单（`??`）——修复在审查-修复循环内未提交时不丢失。不存在 `propose:` commit（零 commit 仓库、或尚未生成方案提交）时，退化为 `git diff HEAD` + 未跟踪清单组合。审查期间新产生的修复改动（循环内每轮修复未提交）始终计入审查范围，不在中途产生新 commit（提交只发生在正常清零后的统一提交，见步骤 5）。

### 2. 枚举工件路径（仅首轮执行一次；不读取内容）

枚举该 change 目录下的 `proposal.md`、`design.md`、`tasks.md`（存在的部分即可，缺失的容错跳过，不报错）以及 `specs/**/*.md` 的全部 delta spec 文件路径（存在多份时全部枚举，不只取其中一份）。这一步只确定路径，不读取文件内容拼接成字符串——审查 subagent 具备自主读取文件的能力。

**基线 spec 引用检测**：检查每份 delta spec 文件是否有显式文字引用了基线 spec 中未被本次修改的既有 Requirement（例如"见……'某 Requirement 名'"这类指代，无论出现在 `## MODIFIED Requirements` 内还是外）。若有，额外把该基线能力对应的 `openspec/specs/<capability>/spec.md` 路径也纳入路径清单，并在 TASK 中说明该文件仅作审查上下文（用于核实引用是否准确），不属于修复对象。

### 3. spawn 双审查 subagent（首轮）

本关卡审查由 **2 个并行审查 subagent** 执行（subagent 多 Agent 模式，不再走独立子进程 shell 调用）。主会话按以下指示 spawn，由运行环境的宿主 spawn 能力落实：

1. **spawn 两个审查 subagent，并行独立审查**（互不见对方结论）：
   - **审查 agent A**：模型 = `~/.ly/config.toml` 的 `[codexHost] reviewModel`；未配置或空白 → 继承当前会话模型。
   - **审查 agent B**：模型 = `[codexHost] reviewModelB`；未配置或空白 → 继承当前会话模型。
2. **fork 当前会话上下文**：两个 agent 均 fork 当前会话上下文启动——主会话讨论中的关键决策、取舍、已知边界等"软上下文"随 fork 到达审查模型，避免关键信息丢失。模型指定只写在模板指示里（取哪个配置字段、未配置用当前会话模型），由宿主 spawn 能力执行，SHALL NOT 依赖任何 shell 层模型参数（无 `-m`/`--model` 类指令）。
3. **模型可用性校验（spawn 前，主会话执行）**：spawn 前 SHALL 读取 `~/.ly/config.toml` 的 `[codexHost] spawnableModels` 校验本次使用的模型值。**生效清单** = `spawnableModels` 清洗后合法非空值（未配置 / 格式非法 / 清洗后为空时回退安装时注入的内置默认清单：`{{SPAWNABLE_MODELS_DEFAULT}}`）∪ `[codexHost]` 已配置的模型字段非空值（**始终并入**，含向导自定义输入——用户显式指定的模型按配置列出）∪ codex 当前主模型（`~/.codex/config.toml` 顶层 `model`，可检测时；仅未显式配置清单时并入；与 `lycx doctor` 口径一致）。校验规则：
   - 配置的模型非空且 ∉ 生效清单 → 判定**配置无效**：明确报告"子代理模型配置无效（<model> 不在可用列表，请运行 `lycx doctor` 或配置 `[codexHost] spawnableModels`）"，停止该关卡转人工改配，SHALL NOT 回退为当前会话直接执行，SHALL NOT 以"运行期失败/审查调用失败"终止条件掩盖。
   - 留空（未配置）→ 回退继承当前会话模型（既有口径）。
   - `spawnableModels` 显式存在但为空数组/非数组（形态异常）→ 视同未配置，生效清单 = 内置默认 ∪ 已配置模型字段值 ∪ codex 主模型（与 `lycx doctor` 口径一致；内置默认以当前 `lycx` 版本为准，以 `lycx doctor` 输出为准）。
   - 读取 `~/.ly/config.toml` 失败（缺文件/解析错误）→ 视为**配置状态未知**：明确提示"无法读取配置，请运行 `lycx doctor` 检查"，SHALL NOT 按"未配置"静默继承回退。
   - 配置合法但宿主无 subagent 能力或初始 spawn 失败 → 按既有"环境级不可用"口径回退当前会话直接执行并如实报告"已回退，原因：subagent 不可用"。
   - spawn 失败报错原文含 `Available models: ...` 时如实展示，并可提示用户据此维护 `spawnableModels`。
4. **TASK 范围点名（只审 change 范围）**：每个审查 subagent 的任务均点名"只审该 change 的下列产物"，SHALL NOT 超出点名范围作业。TASK 先指示读取 ROLE_FILE（两个 agent 均用 `~/.ly/prompts/codex/plan-reviewer.md`，角色词内容不重写），再列出路径清单（步骤 2 枚举的 artifact + delta spec；若步骤 2 检测到基线 spec 引用，同时说明基线路径仅作审查上下文、不属于修复对象）。**首轮只传路径清单，不拼贴文件全文**——审查 subagent 具备自主读取文件的能力，需要实际内容时自行读取。

TASK 核心约束（写入每个审查 subagent 的任务）：
- 只审查该 change 目录下 artifact 之间的内在一致性和完整性（proposal vs design vs tasks vs spec 是否互相矛盾、是否有遗漏）
- 可做轻量代码库确认（确认 plan 列出的文件路径是否存在、grep 硬编码数字/常量是否遗漏关联文件），但不深入读源码实现、不做逐行代码审查——后者是 apply 后 code-review 的职责
- 不把'代码库尚未实现该方案条目'当作 Critical（方案审查阶段代码库本来就没有实现，这是正常状态）

OUTPUT 约束（写入每个审查 subagent 的任务）：审查发现按严重度分级 Critical/Warning/Info，每条含位置/条目（含可解析的文件相对路径）、问题描述、建议。

**两 agent 结论汇合（独立审 → 交换 → 共识）**：

1. 两个 agent 独立审查完毕后，**由主会话将 A/B 结论互转给双方**（两 subagent 由宿主并行 spawn、不直连），各自针对对方结论给出最终意见后，主会话再归并共识。
2. **共识归并**：两 agent 结论合并去重后作为本轮审查结论；部分重叠或冲突的条目 SHALL 一并列出交主会话判定，SHALL NOT 静默丢弃任一 agent 的独立发现。
3. **意见分歧**（agent A 提出 Critical 而 agent B 未提出，或两者结论冲突）→ **主会话拍板**，且 SHALL **显式提示用户"这是审查分歧"**：主会话能确认 → 按确认结论处理；不能确认 → 判定该条为 Critical（red）进入修复循环。
4. **分歧时序**：双 agent 首次分歧且主会话不能确认 → 判定 Critical 进入修复循环；下一轮复审双 agent 仍分歧且主会话仍不能确认 → 触发"分歧未决"终止条件（终止条件 5）。

**审查调用失败（区分两阶段）**：

- **运行期失败**（spawn 后超时、返回内容格式不符、审查 agent 未返回有效结论、双审查任一 agent 调用失败且无法按回退口径继续、回退不可行或回退后仍失败）→ 视为**独立终止条件**，如实报告原因并停止循环，**不得**把失败等同于"本轮无 Critical"或视为清零通过。
- **环境级不可用**（配置合法时宿主无 subagent 能力、初始 spawn 不可用）→ 按回退口径处理：回退为当前会话直接执行审查，并如实报告"已回退，原因：subagent 不可用"，SHALL NOT 视为流程失败中断整体编排。
- **单一 agent 失败且另一 agent 结论完整** → 以完整一方结论继续审查，如实报告降级（含失败 agent 与原因），SHALL NOT 归入"分歧未决"（环境级失败非意见分歧）；是否补跑/重试由主会话决定。

本轮结束后，无论是否有 Critical，都先生成"本轮执行日志"（见"逐轮执行日志"一节），再判定：

若本轮 Critical 数为 0 → 跳到步骤 5 输出报告，结束（不进入循环）。
若本轮 Critical > 0 → 进入步骤 4 循环体。

### 4. 审查-修复循环

对本轮全部 Critical，逐条执行：

**4.1 当前会话先判断是否认可该 Critical**（同 `@lyx-review-code`）

- **认可**：判断问题确实存在，进入 4.2 修复。
- **不认可**：判断为误报、对上下文理解有误、或建议本身有问题，则不修改任何文件，但必须在本轮报告里写明反驳理由。

**4.2 修复（仅针对认可的 Critical）**

修改该 change 的 `proposal.md`/`design.md`/`tasks.md`/`specs/**/*.md`（该 change 目录下的 delta spec 文件），修复范围为"Critical 直接指向的条目" + "修复它所必需的直接依赖条目"（例如"proposal 与 tasks 范围不一致"这类问题往往需要同步改动多处才能真正修好；"spec 未覆盖 proposal 的 What Changes"这类问题的修复方式就是编辑对应 delta spec 文件）；不得借机改动无关内容。若改动涉及必需依赖条目，本轮报告必须逐项说明关联性。

**4.3 本轮验证**

修复完成后运行一次 `openspec validate --changes <change-name>`。验证失败 → 立即停止循环，不再进行下一轮修复，报告本轮改动的文件清单及 `openspec validate` 的失败信息，说明需要人工介入。

**4.4 记录本轮改动文件清单（不提交）**

验证通过后，把本轮实际改动的 artifact/delta spec 文件相对路径清单写入本轮报告——供 4.5 步构造下一轮增量 TASK 直接复用，不得靠"运行时的 git 状态"反推（后续轮次还会继续修改文件，仅凭某个时间点的 git 状态无法可靠还原"本轮具体改了什么"）。本轮不执行任何 git commit——提交只发生在循环以正常清零结束之后（见步骤 5）。

**4.5 自动触发下一轮审查（增量传递；沿用同一批审查 subagent）**

从第 2 轮起，TASK SHALL NOT 重新传整份 proposal/design/tasks/specs 内容；改为仅包含：

1. 上一轮审查 subagent（A/B）报告的全部 Critical 原文（逐字，不经改写，包含被判定"不认可"的条目）。
2. 路径清单，必须覆盖"本轮实际改动的 artifact/delta spec 文件"（4.4 记录的清单）∪"上一轮全部 Critical 各自指向的 artifact/delta spec 文件"（即使未被修改）。若上一轮某条 Critical 指向的文件已被删除或重命名，路径清单改用新路径（若有）并说明状态变化。

路径清单之外的文件不重新整段传入。若某条上一轮 Critical 的位置字段缺失可解析路径，命令保守处理：将该 change 目录下全部 artifact/delta spec 路径纳入下一轮路径清单，并在报告中说明该情况（不得静默丢弃该 Critical）。

**第 2 轮起沿用同一批审查 subagent 会话**：fork 启动的 subagent 会话具备轮间记忆，第 2 轮继续使用同一批审查 subagent（A/B），无需重新 spawn 或整段重传基线——增量传递规则不变，会话记忆提供连续性，不代表 TASK 可省略逐字 Critical 原文。回到步骤 3 的执行方式（只是 TASK 内容换成上述增量内容），重新派发审查，不要求用户手动重新触发命令。生成本轮执行日志后再判定 Critical 是否清零。

### 循环终止条件（任一命中即停止，转步骤 5）

复用 `@lyx-review-code` 的同一套规则，全局轮数上限同样默认 5 轮（清零优先于轮数上限：本轮先判 Critical 是否清零，仅非清零时才检查是否达到 5 轮）：

1. **正常清零**：某一轮审查 Critical 数为 0
2. **熔断**：同一个 Critical（以"文件路径 + 问题类别 + 定位锚点（artifact 内的具体条目/章节）"三者共同判定为同一问题）在相邻两轮审查中都被判定为存在，且上一轮当前会话对它是"认可"状态
3. **无法安全自动修复**：需要产品/业务决策、依赖当前会话不具备的信息，或当前会话判断信息不足——不得进行猜测性修改
4. **修复后验证失败**：见 4.3（`openspec validate` 未通过）
5. **分歧未决**：当前会话上一轮判断"不认可"（未修改），下一轮审查 subagent 仍判定同一问题存在；或双 agent 复审仍分歧且主会话仍不能确认（见步骤 3"分歧时序"）
6. **审查对象类型持续系统性误判**：连续 3 轮（含本轮）审查中，每一轮的全部 Critical 都被当前会话判定为同一大类系统性误判——即审查 subagent 反复以"该轮 Critical 所依据的判断类别不属于方案审查范畴"为由被判定不认可（例如连续 3 轮的 Critical 均以"代码库尚未实现该方案条目"作为理由），不要求这 3 轮之间 Critical 的文件/类别/锚点相互匹配，只要求"判定为不认可的理由类别"在这 3 轮中一致
7. **达到全局轮数上限**（5 轮，独立于上面 1-6 的判定）

触发条件 2-6（或达到全局轮数上限）时，立即停止循环，不执行任何提交（改动留在工作区），报告中必须明确指出触发的具体条件、涉及的问题（文件/类别/章节/判定依据），并说明需要人工介入。"分歧未决"额外要求并列展示审查 subagent 每一轮的原始发现与当前会话每一轮的反驳理由；"审查对象类型持续系统性误判"同样要求并列展示，但展示连续 3 轮（而不是 2 轮）的原始发现与反驳理由。循环期间的 Warning/Info 不参与终止判定，只在最终报告列出**最后一轮**结果。

### 逐轮执行日志

每一轮审查 subagent 派发完成后（包括首轮 Critical 为 0、直接结束的情况），都要在报告中包含一个独立区块，逐字展示该轮审查 subagent 返回的原始 Critical/Warning/Info 内容（不经概括、改写或合并），与当前会话对该轮每条 Critical 的认可/不认可判定并排列出（若该轮无 Critical，只展示原文）。这个区块在该轮审查返回之后即可呈现，不是流式展示。这是给需要核实细节的人看的补充材料；最终报告的主体是人话摘要（见步骤 5），二者并存，不互相替代。

**硬性约束（逐字执行）**：该区块中的 Warning/Info 与 Critical 同样必须逐字完整贴出，**禁止用省略号（"…"、"（同前）"等）压缩**；**清零轮（无 Critical）的判定仍需写明依据**——对照前一轮各 Critical 的修复/确认情况说明"认可清零"的理由，不得仅以"无 Critical，正常清零"一句带过。

### 5. 输出报告

**正常清零结束：**

先执行统一提交：先 `git add` 该 change 目录下的 `proposal.md`/`design.md`/`tasks.md` 及全部 delta spec 文件（审查目标全部文件——编排方（`@lyx-propose`）已暂存的产物与循环期间修复的改动一并暂存；若产物此前已在暂存区则保持，修复改动由本次 `git add` 覆盖进 index），再执行一次统一 commit（仅暂存并提交这些文件，不做范围外的 `git add`），提交信息形如 `fix: review-plan feedback (经 N 轮修复) - <change-name>`。**不存在"循环开始前已脏文件的隔离跳过"**——该 change 目录下的 artifact 与 delta spec 是合法审查对象，产物与修复是同一个待提交单元，全部一并提交。若循环全程没有任何 Critical 被认可修复（从未发生实际改动），不创建空 commit。若统一提交本身执行失败，在报告中如实说明该失败，视为"清零但提交失败"的独立结果——不重新进入循环（已经清零），但要指出还需要人工手动完成这次提交。若传入 `--no-commit`，跳过这次统一提交，修复结果留给调用方或用户自行处理。

```
📋 方案审查：<change-name>

## Critical（必须修复）
（本次已自动修复 N 个 Critical，或为空——若曾发现并修复过，必须写明"本次已自动修复 N 个 Critical"，不得用"未发现问题"掩盖。每条用非技术人员能看懂的人话概括问题和已做的改动）

## Warning（建议修复，最后一轮结果）
1. [proposal.md / design.md / tasks.md / specs/**/*.md] — <问题描述，人话>
   建议: <具体建议>

## Info（供参考，最后一轮结果）
1. [proposal.md / design.md / tasks.md / specs/**/*.md] — <观察/建议，人话>

## 逐轮执行日志
（见"逐轮执行日志"一节，按轮次顺序列出每轮审查 subagent 原文 + 当前会话判定，作为补充材料）

---
总轮次: [轮数]
总计（最后一轮）: [N] Critical, [M] Warning, [K] Info
提交: [已提交 <commit信息> / 未提交（--no-commit） / 无可提交内容 / 提交失败：<原始错误>]
```

**熔断/分歧未决/无法安全修复/验证失败/审查调用失败/达到轮数上限/审查对象类型持续系统性误判结束：**

不执行任何提交，改动留在工作区。

```
📋 方案审查：<change-name> — 循环终止：<触发条件>

## 终止详情
<用人话说清楚发现了什么问题、卡在哪、涉及哪些文件/章节>

（"分歧未决"额外展示，展示 2 轮）
### 审查 subagent 各轮原始发现
第 N 轮：<原文>
### 当前会话各轮反驳理由
第 N 轮：<理由>

（"审查对象类型持续系统性误判"额外展示，展示连续 3 轮）
### 审查 subagent 各轮原始发现
第 N 轮：<原文>
第 N+1 轮：<原文>
第 N+2 轮：<原文>
### 当前会话各轮反驳理由
第 N 轮：<理由>
第 N+1 轮：<理由>
第 N+2 轮：<理由>

## 逐轮执行日志
（同上）

## 需要人工介入
<人话说明，改动都留在工作区未提交，可用 git diff 查看>

---
总轮次: [轮数]
本次未提交任何改动
```

如从未出现任何 Critical/Warning/Info，明确说明"方案审查未发现问题"，不要保持沉默。
