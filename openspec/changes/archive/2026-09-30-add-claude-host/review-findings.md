## 代码审查

- 执行轮次：2（第 1 轮 Critical 0；第 2 轮发现 3 条 Critical，认可修复 2 条、不认可 1 条（误报），复评 3 条全部解决后清零）
- 记录时间：2026-09-30T02:57:29.000Z
- 基线：280fa16（apply 阶段提交，Change-Stage: apply / Change-Name: add-claude-host）
- 基线状态：清零后已执行统一提交 `e519907`（Change-Stage: review-code-fix）；本快照在其之后写入，保持未跟踪

1. [src/commands/doctor.ts:56-69、src/commands/doctor.ts:112-115、src/hosts/codex/doctor.ts:177-185、src/hosts/claude/doctor.ts:42-50] — `doctor` / `status` 没有捕获 `listPrefixedDirs` 现在可能抛出的 IO/权限错误
   问题：例如 skills 目录 `EACCES` 时，命令会中断并打印 stack trace，而不是输出该宿主体检失败。该抛错行为是本轮为修 Critical 3 有意引入的（不再把错误吞成空数组），但没有同步给 doctor/status 加兜底。
   建议：在 `collectHostDoctorChecks` 或各宿主 `doctorChecks` 内捕获并返回 `fail` 体检项。
2. [src/hosts/codex/adapter.ts:172-193] — legacy `ly-*` skills 和 `~/.codex/prompts/ly-*.md` 清理失败时只 `push` error，不设置 `report.success = false`
   问题：卸载整体结果仍可能是 success，菜单会显示成功。
   建议：这两类清理失败也把宿主 report 标记为失败。
3. [src/i18n/index.ts:303、src/i18n/index.ts:615、src/commands/menu.ts:537-568] — 菜单卸载确认仍只描述 codex 产物范围，但随后可能选择或默认卸载 claude
   问题：只安装 Claude 时，用户确认的文案列的是 codex 路径，实际删除 `~/.claude/skills/lyx-*`、`~/.claude/agents/lyx-*.md` 和 `~/.claude/lyx/`。
   建议：先解析宿主集合，再用 `describeUninstallTargets(hosts)` 生成确认文案。
