# context.md — fix-workflow-issues-2026-10

软上下文：五条问题来自 `docs/lyx-workflow-issues-2026-10-10.md`，逐条复核均仍存在。

## 关键决策

1. **outside-project 独立成状态**，不并入 `unhealthy`：位置错误需要"在项目内 openspec init"这一特定修复动作与提示。
2. **项目顶层取 git toplevel，失败回退 cwd**；root 必须在其下（或相等）。monorepo 放在仓库上层的 root 会被判 out——这是有意的收紧。
3. **ensure 把 outside-project 当 missing**：allowWrite 时执行 init-root，执行后重查；只读时给指引。
4. **unborn HEAD 禁用 worktree 选项**：不让用户选一个必然失败的选项。
5. **WIP 文案按路径参数化**：只有切新分支才有"切分支前"语义。
6. **init 规范顺序**：先 `openspec init`，再 `lycx openspec ensure`。

## 已否决

- 把 root 位置错误塞进 `unhealthy`：会丢失可执行的修复指引。
- 只告警不阻断：产物会继续写到仓库外，`git status` 不可见。
- 自动删除家目录 root：破坏性且可能影响其他项目。

## 已知坑

- 路径比较必须 `realpath` 归一化；无法 realpath 时退回字符串比较并在报告注明。
- `ensure` 修复后要重新检查 root，不能只看 init 命令退出码。
- `@lyx-init` 不能只看 `healthy`，还要校验 `root.path` 位置。
- 纯模板与 CLI 混合改动，慢验证统一由归档前关卡执行。
