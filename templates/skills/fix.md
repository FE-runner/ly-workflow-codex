---
name: lyx-fix
description: '小需求 / bug 轻量流程：定位 → spec 分流（A 对齐 / B 就地改主 spec / C 转 @lyx-propose）→ 按测试风险实施与验证 → 主 agent 五项自审 → 最终验证门禁 → 单 commit；不创建 OpenSpec change'
argument-hint: '<问题或需求描述>'
---

# Fix - 轻量修复

> 调用方式：`@lyx-fix` mention 后跟随的自然语言即参数（如 `@lyx-fix` 带需求描述/选项）；无参数时直接 `@lyx-fix`。

无参数时先询问要修复什么，不猜测。

面向小需求与 bug 修复的单命令轻量路径：一次完成「定位 → spec 分流 → 实施 → 自审 → 最终验证 →（B 类确认）→ 提交」，只产生**一个 commit**。本命令：

- SHALL NOT 创建 OpenSpec change 目录，SHALL NOT 写 `context.md`；MAY 写 `review-findings.md`（如追加解决标注），写入内容属于本次修复的待提交单元；
- SHALL NOT 询问隔离方式或全自动/手动，SHALL NOT 创建分支或 worktree，直接在当前分支工作（需要隔离时由用户先自行 `@lyx-worktree`）；
- 执行主体固定为主 agent：仅解析当前项目的有效 `testMode`，审查/实施执行者、审查范围与模型字段均不影响本命令，SHALL NOT spawn 子代理。

主 spec 同步是本命令的强制职责——轻流程绕开了 delta 与归档，spec 不随改动同步就会漂移。

## 步骤

### 0. 预存改动检查

执行 `git status --porcelain` 并记录结果。存在预存改动时如实提示并记录其路径清单；这些改动 SHALL NOT 被纳入本次提交（步骤 7 按路径暂存）。若预存改动与本次需要修改的文件重叠、无法区分，停止并说明，由用户先处理。

### 1. 定位

读相关代码，弄清问题根因或需求落点；同时以涉及的命令名、配置 key、函数名等检索 `openspec/specs/`，找出相关 Requirement / Scenario。

### 2. spec 分流（强制，实施前必须给出结论）

对照相关 Requirement 给出以下结论之一，**展示给用户**并写明依据：

- **A（代码对齐 spec）**：改动使代码符合既有 Requirement / Scenario，主 spec 不改。点名对齐的 Requirement。
- **B（小幅行为变化）**：改动改变或新增少量 Scenario / Requirement 描述的行为。主 spec SHALL 在同一提交中**就地修改**（直接编辑 `openspec/specs/<capability>/spec.md`），SHALL NOT 创建 delta spec、SHALL NOT 经归档合并。点名将修改的 capability 与条目。
- **C（超出轻流程）**：命中任一条件——需要新增 capability、新增多条 Requirement、跨多个模块的设计取舍、需要产品决策、需改动的 capability 在进行中 change（`openspec/changes/` 下未归档目录）中存在 delta spec。此时 SHALL 停止，写明判定理由，建议改用 `@lyx-propose`（进行中 delta 的情况也可先完成该 change），不修改任何文件。用户明确坚持留在轻流程时，按 B 继续，并在提交正文 `- spec：` 注明"用户坚持轻流程"。

项目不存在 `openspec/specs/` 时，结论记为**无 spec 基线**：跳过 spec 同步与自审②，其余步骤照常。

SHALL NOT 在未给出分流结论的情况下开始实施。

### 3. 实施（按测试风险执行）

实施前 SHALL 读取 `{{LYX_CONFIG_FILE}}` 并解析当前项目的有效 `testMode`：项目路径按主仓库根归一（普通 checkout 与 separate-git-dir checkout 用 `show-toplevel`，子模块用自身 `show-toplevel`，非 bare linked worktree 能确定主工作树时用主树根，bare worktree 或 separate-git-dir 无法反推主树时用当前 worktree 的 `show-toplevel`，非 Git 目录用规范化 cwd）；优先级为 `[projects."<项目根>"].testMode` > `[host].testMode` > `normal`。项目覆盖缺失时回退宿主默认，项目覆盖取值非法时回退宿主默认并由 doctor 告警；配置文件整体缺失、不可读或 TOML 解析失败时 SHALL 停止并提示运行 `lycx doctor`，SHALL NOT 静默按 `normal` 继续。宿主配置缺失、不可读或解析失败时 SHALL 停止并提示运行 `lycx doctor`；宿主默认字段缺失、空白或非法时按 `normal` 处理。

- `testMode = "off"`：SHALL NOT 新增或修改测试文件、SHALL NOT 生成测试任务、SHALL NOT 运行任何测试命令；行为或契约改动仍正常实施，并改用类型检查、构建或其他非测试验证。混合任务只跳过测试部分，不跳过实现部分。来源为项目覆盖时，跳过状态写为 `[跳过] ...（testMode=off，项目配置）`。
- `testMode = "normal"`：按 `risk-based-testing-policy` 对改动单元分类并记录测试策略：

1. **行为或契约改动、逻辑缺陷修复**：在可自动化时先编写能复现问题或刻画新行为的测试并运行，**确认其失败**，记录失败输出（供自审⑤核对）；再修改实现直到该测试与相关测试通过。B 类同时就地修改主 spec。
2. **纯 UI、文案、样式**：改动只涉及静态展示、文案、样式、布局或图标，且不改变状态、事件、条件分支、数据流、业务计算、公开组件契约、接口或配置行为时，SHALL NOT 被要求新增自动化测试；仍须运行相关既有测试、类型检查或构建，并在可用时执行视觉检查。
3. **补充边界覆盖**：未被用户请求、既有 Scenario 或确认缺陷复现所要求的额外边界，不作为本次实施任务自动扩展。
4. 无法编写自动化测试、测试无法复现失败，或环境无法执行相称验证时，记录具体原因；后者同时在自审①中复核诊断是否成立。SHALL NOT 静默省略。

只改本次修复需要的文件，不顺手重构、格式化或扩展功能。

### 4. 自审（主 agent 一轮，对稳定 diff 执行）

按风险策略完成相关测试或验证后、最终验证之前，对 `git diff` 的实际改动逐项给出结论：

- **① 修对了吗**：修的是根因而非症状；用户原始描述逐条覆盖。
- **② spec 一致吗**：用实际 diff 复核步骤 2 的分流结论——判 A 但 diff 改变了 spec 描述的行为 → 改判 B 并补改主 spec；判 B 但 spec 与 diff 不一致 → 修正。以 diff 涉及的标识符检索 `openspec/specs/`，命中的 Requirement 逐条确认仍成立。
- **③ 漏改了吗**：同一逻辑的其他调用点与分支是否有同样问题；成对位置是否同步。成对清单 SHALL 优先读取项目 `AGENTS.md` 的「改动对称清单」小节逐项核对；该小节缺失时按代码结构推断成对位置并说明推断依据，SHALL NOT 因小节缺失而跳过本项。
- **④ 改多了吗**：diff 不含与本次修复无关的改动，预存改动未混入。
- **⑤ 验证充分吗**：按 `risk-based-testing-policy` 核对复现测试、行为验证或纯展示验证是否充分；无法验证的原因是否如实记录。

自审发现的问题直接修正，纳入同一提交。补充边界覆盖缺失 SHALL NOT 作为自审不通过条件。自审**不分级**（不用 Critical/Warning/Info）、**不循环**，不覆盖安全/性能/风格等通用审查维度——这些问题若存在，说明改动已超出轻流程，应转 `@lyx-propose`。

### 5. 最终验证（提交门禁）

自审（含修正）完成后运行：项目提供的类型检查 + build 或其他非测试验证；`testMode = "normal"` 时另运行与本次改动相关的测试；纯展示改动按可用性运行视觉检查。验证失败处理规则保持不变。

- 失败 → 修正后重跑，且只对为修复验证失败新增的 diff 重新执行自审③④。
- 同一验证**连续失败 2 次** → 停止，原样呈报失败输出转人工；改动保留在工作区，SHALL NOT 提交。

### 6. B 类提交前确认

分流结论（含自审复核后）为 **B** 时，SHALL **展示主 spec 的改动** diff 与代码改动摘要，等待用户确认：

- 确认 → 进入步骤 7；
- 要求修改 → 修改后**重新执行步骤 5 的最终验证**（并只对本轮修改新增的 diff 重跑自审③④），通过后重新展示确认；SHALL NOT 在未重新通过验证时进入步骤 7；
- 拒绝 → 不提交，改动保留在工作区，说明当前状态。

结论为 **A** 或**无 spec 基线**时直接进入步骤 7，不发起确认。

### 7. 提交（单个 commit）

1. **按路径暂存**本次修复涉及的代码、主 spec 文件，以及 `testMode = "normal"` 时新增或修改的测试文件：`git add -- <文件清单>`。SHALL NOT 使用全量暂存，SHALL NOT 纳入预存改动；本次修复主动写入的 `review-findings.md` SHALL 随路径清单一并暂存。若暂存区在步骤 0 时已有其他 staged 内容，用 `git commit --only -F "$MSG_FILE" -- <文件清单>` 隔离提交（`-F` 放在 `--` 之前）。
2. 用 `MSG_FILE="$(git rev-parse --git-path COMMIT_EDITMSG)"` 获取路径，按 `@lyx-commit` 正文规范写入完整 message，执行 `git commit -F "$MSG_FILE"`：

   ```
   <type>(<scope>): <subject>

   - 动机：<用户原始描述的问题或需求>
   - 改动：<实现要点>
   - 影响：<行为变化与兼容性>
   - spec：<A：不涉及，代码对齐 <capability>「<Requirement>」 / B：<capability> 修改「<Requirement / Scenario>」 / 无 spec 基线>
   - 自审：<五项中有内容的结论，一两行；无法新增或执行相称验证时写原因>
   - 验证：<运行的验证与结果；未运行项写原因>
   ```

   - type 按实际改动判断（`fix` / `feat` / `refactor` 等）；scope 为代码模块。主 spec 改动是附带改动，不改变 type 与 scope（不用 `docs(openspec)`）。
   - 本提交属于**非 change 生命周期提交**：SHALL NOT 追加 `Change-Stage` / `Change-Name` trailer。
3. 提交后以 `git show --name-only --format=` 核对文件集合等于本次清单。
4. `git commit` 失败 → 如实报告 Git 原始错误，不重试不兜底。

## 输出

结束时简要报告：分流结论、自审五项结论、验证结果、commit hash；未提交时说明停在哪一步、改动状态与可用的下一步（如 `@lyx-propose`、修复后重跑 `@lyx-fix`）。
