# context: add-lyx-fix-lightweight-flow

> 软上下文：只记录 artifact 之外的讨论结论。方案正文见 proposal / design / tasks / specs。

## 关键决策与理由（来自 explore 讨论）

- 用户的主要顾虑是 spec 漂移。讨论确认：全流程本身防不住漂移（`ly-wrapper` 就是走了全流程后留下的僵尸 spec），流程太重反而会促使人绕开流程直接改代码。所以轻流程必须自己负责同步 spec，而不是把同步交给"之后走 propose"。
- 用户明确接受"不经 delta 与审查、直接改主 spec"，前提是代码与 spec 在同一个 commit 中，git log 即可作为审计记录。
- 自审的定位是补上轻流程省掉的那部分风险（对应 design D4），不是把 review-code 缩小一号。用户追问过"自审审什么""自审在哪个阶段"，最终结论见 design D4 / D5。
- 用户对其余开放点（分支、reviewMode=off 是否跳过自审、C 类阈值、explore 衔接、提交前是否确认、对称清单放在哪里）的答复都是"按你的来"，即 design 中的默认取值。

## 已否决的备选

- propose 加 lite 档：仍需走 propose → apply → archive 三步，仪式感减不下来。
- 按文件数 / 行数设硬阈值来判定 C 类：改为由 agent 按判断标准写明理由，用户可以坚持走轻流程。
- `Change-Stage: fix` trailer：违反 `commit-conventions` 的取值集合，且 fix 没有 Change-Name（讨论中先提出、后来自行纠正）。
- 新增 `Lyx-Flow: fix` trailer：目前没有区分需求，先不加。
- 提交前一律停下确认：只对 B 类停下。

## 范围边界

- 不做：给 spec 减重、清理 `ly-wrapper` 等失效 spec（以后单独开 change）；不让 `@lyx-init` 生成对称清单初稿；不新增配置字段。
- 做：新命令、explore 提示分流、本仓库 AGENTS.md 的对称清单、计数与文档同步。

## 已知坑

- 3 个测试文件（`host-adapters` / `installer` / `host-ops`）硬编码了数量 14，包括用例标题和注释，要一起改。
- `host-adapters.test.ts` 用"模板文件集合 == 注册命令集合"做断言，所以模板和注册必须同步新增。
- 模板正文里用 `@lyx-` 标识命令，claude 宿主会把它渲染成 `/lyx-`。测试断言要用 `t()` 改写前缀。
- 本仓库验证命令：`pnpm typecheck && pnpm build && pnpm test`。

## 实施决策（apply 阶段回写）

- `fix.md` 的调用方式行必须沿用标准句式（`（如 \`@lyx-xxx\` 带需求描述/选项）；无参数时直接 \`@lyx-xxx\`。`），否则 claude 适配器的正则不会改写这一行，`mention` 字样会残留（claude-host 测试会拦下）。"无参数时先询问"因此单独写成一段。
- `fix.md` 正文刻意不出现 `reviewExecutor` / `reviewMode` / `config.toml` 等字面量，改用"不读取宿主配置文件"来表述，好让测试用 `not.toMatch` 机械守住"不读配置"这条约束；同理，trailer 约束写成 `` `Change-Stage` / `Change-Name` trailer ``，不带冒号。
- explore 的 frontmatter description 也同步改成"按规模引导走 @lyx-fix / @lyx-propose"，避免 skill 列表里的描述与正文不一致。
- AGENTS.md 里没有独立的命令表，所以 `@lyx-fix` 落在"关键设计决策 8"和新增的「改动对称清单」小节中；README 双语的"典型工作流"代码块里补了 `@lyx-fix` 的示例。
