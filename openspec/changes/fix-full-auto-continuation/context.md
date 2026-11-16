# Context

本文件只记录 artifacts 之外的讨论结论；需求与行为契约见 `proposal.md` 和 delta specs，技术设计见 `design.md`。

## 已确认的根因证据

- 本机已安装的 `lyx-propose/SKILL.md` 已包含“阶段报告非终态”，所以问题不是本机没装上次修复。
- Codex 没有模型可调用的通用“运行另一个 skill”工具；主 agent 必须显式读取下一阶段 bundle。
- 现有 propose 行为评测只验证“停在第一个隔离询问”，continuation 段落仍为 `not-executed`。

## 关键决策

- 使用当前 skill 同级目录的相对坐标，不写死 `~/.agents/skills` 或 `~/.claude/skills`；同一规则覆盖全局、项目级和评测 fixture。
- “读取下一阶段主文件及其全部 references”是交接动作的一部分；输出 `@lyx-*` 或说“下一步将执行”不算执行。
- 默认评测套件继续只有四个基础场景；`propose-full-auto` 是显式运行的第五个场景，避免破坏既有 8 单元审计口径。

## 已否决的备选

- 加更多“不要停”文案：无法把文字命令变成可执行动作。
- 写死全局 skill 绝对路径：项目级安装和评测 fixture 会失效。
- 用 shell 启动 `codex exec` 续跑：违反本项目无 wrapper / 外部编排边界。
- 把连续性场景塞进现有 propose 首问场景：会丢失原有边界场景。

## 范围边界

- 不改 reviewMode、审查终止条件、commit 格式、archive 流程或默认 CI。
- 不自动启动下一阶段以外的 lifecycle 命令，不自动 archive。

## 已知坑

- 主 skill 增量必须简短，现有 20,000 字节上限测试不能退化。
- 连续性 fixture 必须产生真实 apply 改动和 apply 阶段 commit；只看最终文本出现 `apply` 会误判。
- 真实评测可能受模型、网络或认证影响，环境失败只能记 `not-executed`。
- 已安装副本需要 `lycx update` 或后续发版才会采用新模板。
