## 1. 配置模型与有效值解析

- [ ] 1.1 在 `src/types/index.ts` 增加项目测试模式条目与 `LyConfig.projects` 类型，并在 `src/utils/config.ts` 增加项目表清洗/保留辅助；让 `readLyConfig` / `writeLyConfig` / `createDefaultConfig` 显式携带 `[projects]`，验证 `pnpm typecheck` 通过且 `smol-toml` 读写样例保留项目表
- [ ] 1.2 新增共享项目配置解析模块：实现主仓库根归一（普通仓库、子目录、linked worktree、无 Git fallback）、项目条目精确匹配、有效 `testMode` 与来源/诊断返回，并用 `pnpm exec tsx` 对内联临时路径样例验证项目覆盖、宿主回退与冲突诊断
- [ ] 1.3 修改 `src/commands/init.ts`，在 `createDefaultConfig` 时传入既有 `projects`；验证临时 HOME 环境下先写入多项目条目、再执行 `init --skip-prompt` 后条目仍原样存在

## 2. 项目级 CLI 管理

- [ ] 2.1 新增 `src/commands/project.ts` 与 `src/cli-setup.ts` 命令注册，实现 `lycx project test-mode normal|off`、`--unset`、`--host`、已安装宿主解析、未安装跳过、全部目标写入前预校验与中途失败逐项报告；验证非法参数或预校验失败不写配置且帮助文本列出命令
- [ ] 2.2 在 `src/i18n/index.ts` 的 zh-CN / en 同步增加项目命令提示、成功、跳过、无目标宿主与错误文案；用静态键检查确认两种语言无单边缺失
- [ ] 2.3 使用临时 HOME、临时 Git 仓库与 linked worktree 手工 smoke：从子目录设置/更新/移除项目条目，验证写入主仓库根键、worktree 命中同一键、其他项目条目和其他宿主字段保持不变

## 3. doctor 与 status

- [ ] 3.1 扩展 `src/commands/doctor.ts`、`src/hosts/codex/doctor.ts` 与 `src/hosts/claude/doctor.ts`，展示宿主默认值、当前项目有效值、来源与规范化路径，并对非法项目字段、结构异常和冲突规范化键输出 WARN；验证 `pnpm typecheck` 通过
- [ ] 3.2 在临时宿主配置上运行 `pnpm exec tsx src/cli.ts doctor --host <宿主>` 与 `status --host <宿主>` 的只读 smoke，验证项目覆盖/宿主默认/非法覆盖三种展示

## 4. 工作流模板与角色词

- [ ] 4.1 更新 `templates/skills/fix.md`、`propose.md`、`apply.md`、`archive.md`、`review-plan.md`、`review-code.md`，统一写入“主仓库根 + 项目覆盖 > 宿主默认 > normal”、来源化 `[跳过]` 与配置不可读停止规则；用 `rg` 验证六个文件均可命中项目覆盖、主仓库根、宿主默认、来源与停止规则
- [ ] 4.2 更新 Codex `templates/hosts/codex/prompts/{plan-reviewer,reviewer}.md` 与 Claude `templates/hosts/claude/agents/{lyx-plan-reviewer,lyx-reviewer}.md`，使有效 `testMode=off` 同时抑制项目覆盖与宿主默认来源的测试缺失类发现；用 `rg` 验证四份角色词规则一致
- [ ] 4.3 静态扫描 `src templates`，确认不再存在“仅读取 `[host].testMode` 并忽略项目覆盖”的测试模式读取说明；若命中，修正为有效模式解析契约

## 5. 文档与交互文案

- [ ] 5.1 更新 `AGENTS.md`、`CLAUDE.md` 与 `templates/CLAUDE.md` 的配置示例、有效值优先级、主仓库根/worktree 语义、管理命令与 doctor/status 展示；验证文档路径和命令与实际 CLI 一致
- [ ] 5.2 同步 `README.md` 与 `README.zh-CN.md` 的新命令、宿主默认值定位、项目覆盖行为与示例配置；验证双语语义一致
- [ ] 5.3 更新 init/menu 的 `testMode` 标题、hint 与摘要为“宿主默认测试模式（未命中项目覆盖时生效）”，验证交互文案不再暗示全局最终值

## 6. 门禁验证

- [ ] 6.1 运行 `pnpm typecheck`，确认全部新增类型、命令与 doctor/status 接入通过；如实记录失败原文
- [ ] 6.2 运行 `pnpm build`，确认 CLI 构建与模板打包通过；本次有效 `testMode=off`，不运行测试命令
- [ ] 6.3 运行 `openspec validate --changes project-scoped-test-mode --strict`，确认 proposal/spec/design/tasks 结构与 Requirement/Scenario 合法
