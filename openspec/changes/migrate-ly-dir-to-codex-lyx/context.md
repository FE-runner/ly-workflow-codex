# Context: migrate-ly-dir-to-codex-lyx

## 背景与范围边界

本 change 源于一次探索会话：确认 `~/.ly/` 被安装器代码设计为"ly-workflow（老项目）共享命名空间"，但实测该假设已不成立（两个项目的配置文件已分叉独立，见 proposal.md Why）。范围边界：只解耦 ly-workflow-codex 自身，**不**触碰 ly-workflow（老项目，`~/.claude/.ly/`）的任何代码——它是独立仓库，不在本次改动范围。

## 关键决策（文档之外的理由）

- **新目录命名 `~/.codex/lyx/`**：用户直接拍板，未采纳 `~/.codex/.ly/`（保留 `.ly` 前缀但语义仍暗示"ly 系列共享"）或摊平进 `~/.codex/` 顶层（与 codex 官方自身的 `config.toml`/`prompts/` 撞车）。理由与备选见 design.md 决策 1。
- **不迁移旧值、全新开始**：用户在探索阶段两次确认——先排除"只读探测/拷贝旧值"的中间方案，再明确排除"连提示都不给"之外的折中（见下一条）。
- **不做"检测到旧 `~/.ly` 配置存在"的提示**：这是本次自审阶段的开放问题，曾提议在 `lycx doctor`/`init` 加一条只读提示帮用户发现需要重新配置；用户明确选择"不加任何提示"，维持 design.md Non-Goals 的最严格口径（连只读探测都不做）。**否决理由**：用户未展开说明，但结合此前"全新开始"的一贯立场，判断是不希望引入任何哪怕是只读的"感知旧路径"逻辑，避免留下将来被误用为迁移入口的钩子。
- **uninstall 回归真删除**：用户明确选"真正删除（回归到普通卸载语义）"，而非保留"检测到 worktree 就整体不删"或"交互二次确认"等更保守的选项——见 design.md 决策 3。

## 已知坑（实施时注意）

- `hasCoexistingLegacyLyProducts` 有两个调用方（`config.ts` 的 `migrateLegacyConfig` 与 `installer.ts` 的 `migrateLegacyPrompts`），review-plan 第 1 轮曾漏掉后者，导致"删函数但留调用点"的编译失败风险——两者必须一并移除，任务 2.2-2.6 已覆盖。
- `UninstallResult.configTomlKept` 与 `removedSharedPrompts` 两个字段随本次改动分别改名为 `worktreesKept` 与 `removedPrompts`——如果实施时发现除 tasks.md 列出的消费点（`cli-setup.ts`/`menu.ts`/i18n/测试）之外还有其他引用，按同一改名逻辑处理，不要只改 tasks.md 点名的那几处就收工。

## 审查循环备注

review-plan 经 4 轮收敛（Critical: 5→4→1→0），过程中方案文档本身多次出现"改了一处忘了改另一处"的自我矛盾（如 3.2 任务文案笔误、字段改名遗漏消费点）——这提示 apply 阶段实施时同样要留意"改名/改路径类"任务容易顾此失彼，建议实施后用 tasks.md 8.1 的收尾 grep 命令自查一遍，而不是仅凭逐条 checkbox 打勾就认为完成。
