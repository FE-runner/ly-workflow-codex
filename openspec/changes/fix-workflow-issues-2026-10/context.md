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

## 实施决策（apply 阶段回写）

- `outside-project` 作为独立 root 状态接入 preflight 类型、inspect、actions、ensure、print 与 i18n；项目顶层用 `git rev-parse --show-toplevel`，失败回退 cwd，路径比较前 `realpathSync` 归一化。
- `ensure` 把 `outside-project` 与 `missing` 同等对待，执行 `init-root` 后重新 inspect；只读路径只报告并给 `openspec init` 指引。
- explore 改 `find`（archive 路径保留尾斜杠以兼容既有断言）；propose 增加 unborn HEAD 预检与 `chore: 暂存工作区改动` 文案；init 增加 root 位置校验与"先 init 再 ensure"规范顺序。
- 验证：`pnpm typecheck` / `pnpm test`（398 passed）/ `pnpm build` 全绿；新增 preflight 两个状态单测与模板断言。
