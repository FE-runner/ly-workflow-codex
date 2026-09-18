## 1. 前置 spike（决定实现细节）

- [x] 1.1 验证 trailer 定位命令：在临时 git 仓库构造一个带 `Change-Stage: apply` / `Change-Name: demo` trailer 的 commit，运行 `git log --grep="^Change-Stage: apply$" --grep="^Change-Name: demo$" --all-match -1 --format=%H`，确认能命中该 commit；验证方式 = 记录命令输出确实等于目标 commit SHA，并记录多行锚定是否可靠
- [x] 1.2 若 1.1 判定 `--grep` 多行锚定不可靠，验证 `git interpret-trailers --parse` 兜底：取出 commit message 后解析 trailer 并筛选目标 commit；验证方式 = 记录兜底命令可命中同一 commit（实际未执行：1.1 判定 `--grep` 多行锚定可靠，条件不满足，仅保留 spec 中的兜底路径）
- [x] 1.3 验证 `git commit --only -- <paths>` 对未跟踪新文件的行为：在临时仓库复现"index 含范围外 staged 内容 + 目标范围含未跟踪新文件"，分别测试先 `git add -- <范围>` 与不先 add 两种顺序；验证方式 = 记录哪种顺序能正确隔离提交且不吞范围外内容

## 2. 模板：commit message 结构落地

- [x] 2.1 更新 `templates/skills-codex/propose.md` 步骤 6：提交信息改为 `docs(openspec): <subject>` + `Change-Stage: propose` + `Change-Name: <change-name>` trailer；验证方式 = 文本检查该文件不再含 `git commit -m "propose: <change-name>"` 旧指令，且含新结构说明
- [x] 2.2 更新 `templates/skills-codex/apply.md` 步骤 3：提交信息改为 CC 前缀（type 由主会话按实际改动判断）+ `Change-Stage: apply` + `Change-Name` trailer；验证方式 = 文本检查该文件含"type 由主会话判断"与 `Change-Stage: apply` 说明
- [x] 2.3 更新 `templates/skills-codex/archive.md`：提交信息改为 `chore(openspec): <subject>` + `Change-Stage: archive` trailer；验证方式 = 文本检查 `archive: <change-name>` 旧指令已被替换
- [x] 2.4 更新 `templates/skills-codex/review-plan.md` 步骤 5：清零后统一提交信息改为 `fix(<scope>): review-plan 反馈修复（N 轮）` + `Change-Stage: review-plan-fix` trailer；验证方式 = 文本检查该文件不再含 `fix: review-plan feedback (经 N 轮修复) - <change-name>`
- [x] 2.5 更新 `templates/skills-codex/review-code.md` 步骤 4：清零后统一提交信息改为 `fix(<scope>): review-code 反馈修复（N 轮）` + `Change-Stage: review-code-fix` trailer；验证方式 = 文本检查旧 `fix: review-code (经 N 轮修复)` 已被替换

## 3. 模板：审查对象定位 trailer 化

- [x] 3.1 更新 `templates/skills-codex/review-plan.md` 步骤 1：基线定位改为 trailer 优先（`Change-Stage: propose` + `Change-Name` + `--all-match`），未命中回退 `^propose: <change-name>` 并打印 DEPRECATED 提示；验证方式 = 文本检查该段含 trailer 首选命令与旧前缀回退说明
- [x] 3.2 更新 `templates/skills-codex/review-code.md` 步骤 1 与命令示例块：基线定位改为 trailer 优先（`Change-Stage: apply`，未命中先回退 `^apply:`，再退化到 `propose` 阶段），回退命中时打印 DEPRECATED 提示；验证方式 = 文本检查命令示例块含新 trailer 命令与旧前缀回退
- [x] 3.3 更新 `templates/skills-codex/propose.md` 步骤 8 第 4 项：进入 review-code 前的 SHA 校验改用 trailer 定位（`Change-Stage: apply` + `Change-Name`），保留旧前缀回退；验证方式 = 文本检查该处不再以 `git log --grep="^apply: <change-name>"` 作为唯一判据
- [x] 3.4 更新 `templates/skills-codex/propose.md` 步骤 6 及步骤 8 对审查对象的引用说明：从 `propose:` commit 改为 propose 阶段 commit（trailer 格式）；验证方式 = 文本检查全文不再把 `propose: <change-name>` 当作审查对象标识

## 4. 模板：index 隔离协议统一

- [x] 4.1 更新 `templates/skills-codex/propose.md` 步骤 6：把"index 有范围外 staged 内容即停止"改为共用隔离协议（先 `git add -- <change目录>`，范围外 staged 内容用 `--only` 隔离或 unstage-提交-恢复，同文件混合 hunk 不可分离时停止，提交后 `git show --name-only` 严格属于 change 目录）；验证方式 = 文本检查该段含 `--only` 隔离与"同文件混合 hunk 停止"两条分支
- [x] 4.2 更新 `templates/skills-codex/apply.md` 步骤 3：把提交前隔离描述对齐同一协议（目标范围为本次待提交文件清单，其余分支一致）；验证方式 = 文本检查 apply 段落与 propose 段落引用同一协议分支集合
- [x] 4.3 交叉检查 propose 与 apply 两处隔离协议描述：确认两处分支（无重叠隔离 / 同文件混合 hunk 停止 / 提交后严格校验）一致；验证方式 = 逐分支对照记录结论

## 5. 文档同步

- [x] 5.1 更新 `templates/CLAUDE.md` 的 `apply.md` 行与其他 commit 相关描述，改为新 message 结构与共享隔离协议；验证方式 = 文本检查 `templates/CLAUDE.md` 不再描述 `apply: <change-name>` 旧 message
- [x] 5.2 更新 `openspec/specs/ly-propose-flow/spec.md` 的 Purpose 段落（delta 不覆盖 Purpose）：把 `每步 commit（propose: <change-name>）` 更新为新的 CC + trailer message 结构描述；验证方式 = 文本检查该 Purpose 不再把 `propose: <change-name>` 当作当前约定
- [x] 5.3 更新 `openspec/specs/ly-lifecycle-commands/spec.md` 的 Purpose 段落（delta 不覆盖 Purpose）：把 `apply: <change-name>` 等旧 message 措辞更新为新结构描述；验证方式 = 文本检查该 Purpose 不再把 `apply: <change-name>` 当作当前约定

## 6. 端到端验证

- [x] 6.1 全仓搜索旧格式指令残留：`rg -n 'commit -m "propose:|commit -m "apply:|commit -m "archive:|review-plan feedback|review-code \(经' templates/`，确认无遗漏的旧 message 指令；验证方式 = 搜索输出为空或仅剩刻意保留的兼容通道说明（执行中发现 `src/utils/__tests__/host-adapters.test.ts` 两处断言依赖旧 apply message，已一并修复为 `Change-Stage: apply` / `Change-Name: <change-name>` 断言）
- [x] 6.2 运行 `openspec validate --changes unify-commit-conventions` 确认 delta spec 结构合法；验证方式 = 命令退出码为 0
- [x] 6.3 端到端演练：在临时 git 仓库按新模板流程（propose commit → review-plan 定位 → 隔离提交）走一遍，确认 trailer 定位与 index 隔离协议按规格工作；验证方式 = 记录演练命令与结果，定位命中且隔离提交未吞范围外内容
- [x] 6.4 慢验证（测试 / 类型检查 / 构建）留待 `@lyx-archive` 归档前关卡统一执行，本任务仅确认 `pnpm typecheck && pnpm build && pnpm test` 的命令名存在；验证方式 = 读取 `package.json` 确认三个脚本均存在
