## 1. 核心路径常量

- [ ] 1.1 修改 `src/utils/package-meta.ts`：`LY_DIR` 从 `join(homedir(), '.ly')` 改为 `join(homedir(), '.codex', 'lyx')`，同步更新其上方注释（`~/.ly` → `~/.codex/lyx`）；`CONFIG_FILE`/`PROMPTS_DIR` 无需改动（派生自 `LY_DIR`）。验证：`grep -n "LY_DIR" src/utils/package-meta.ts` 确认新路径。

## 2. 移除旧路径迁移/共存检测逻辑

- [ ] 2.1 从 `src/utils/config.ts` 删除 `hasCoexistingLegacyLyProducts` 函数（含其文档注释）与 `migrateLegacyConfig` 函数（含其文档注释），删除文件顶部"配置目录统一到 ~/.ly/（v0.1.0 起；旧 ~/.claude/.ly/ 由 migrateLegacyConfig 迁移）"注释；删除 `readLyConfig`/`writeLyConfig` 内对 `migrateLegacyConfig()` 的调用。验证：`grep -n "migrateLegacyConfig\|hasCoexistingLegacyLyProducts" src/utils/config.ts` 无输出。
- [ ] 2.2 从 `src/utils/installer.ts` 移除对 `hasCoexistingLegacyLyProducts` 的导入与调用（第 6 行导入、第 206 行调用所在的共存检测分支），改为直接执行原分支后续逻辑（不再有"共存则跳过"判断点，因为该判断点本就服务于旧迁移逻辑）。验证：`grep -n "hasCoexistingLegacyLyProducts" src/utils/installer.ts` 无输出；`npm run build`（或项目对应的类型检查命令）通过。
- [ ] 2.3 从 `src/utils/__tests__/config.test.ts` 删除覆盖 `migrateLegacyConfig` 的全部测试用例（含 import 中的 `migrateLegacyConfig`），若存在覆盖 `hasCoexistingLegacyLyProducts` 的独立测试用例一并删除。验证：`grep -n "migrateLegacyConfig\|hasCoexistingLegacyLyProducts" src/utils/__tests__/config.test.ts` 无输出；`npm test -- config.test.ts` 通过。

## 3. uninstall 策略重写（真正删除 + worktree 存活检测）

- [ ] 3.1 修改 `src/utils/installer.ts` 的 `uninstallWorkflows`：把"共享配置：保守保留 + 提示"这段（约第 422-428 行）改为——先检测 `~/.codex/lyx/worktrees/` 下每个子目录是否为有效 git worktree（在该子目录执行 `git rev-parse --git-dir` 判断，命令失败或非 git 目录视为"非存活 worktree"；执行异常/权限错误时保守按"存活"处理）；不存在任何存活 worktree → 删除整个 `~/.codex/lyx/`（`config.toml`、`prompts/`、`worktrees/` 一并清理）；存在存活 worktree → 只删除 `config.toml` 与 `prompts/`，保留 `worktrees/` 目录并警告提示"检测到未清理的 worktree，请先运行 `lycx worktree remove` 清理后再手动删除 `~/.codex/lyx/`"。同步更新 `UninstallResult` 接口的字段注释（`configTomlKept` 字段含义随之改变——不再是"保守保留"，而是"因存活 worktree 而部分保留"，如无存活 worktree 该字段应为 `false`）。验证：新增/更新 `src/utils/__tests__/host-adapters.test.ts` 或 `installer.test.ts` 中的对应断言（见任务 5.x）。
- [ ] 3.2 修改 `src/cli-setup.ts` 的 uninstall 确认提示文案（约第 131 行）：把"共享配置 ~/.ly/config.toml 与 ~/.ly/ 其余内容（含 worktrees）保留"改为如实描述新行为——"将移除 ~/.agents/skills/lyx-*（含旧残留）、~/.ly/prompts/codex/ 与 ~/.codex/lyx/（配置、角色词、worktrees）；若 ~/.codex/lyx/worktrees/ 下存在未清理的实际 git worktree，该子目录会被保留并提示需先手动清理"。验证：人工比对文案与任务 3.1 实现的实际行为一致。
- [ ] 3.3 更新 `installer.ts` 中所有"共享命名空间/共享配置/共享角色词"相关注释（约第 40、157、309、311、319、320、330、409 行），改为描述新的私有目录语义（不再提"ly-workflow 共享命名空间"）。验证：`grep -n "共享命名空间" src/utils/installer.ts` 无输出。

## 4. 角色词模板与技能模板路径更新

- [ ] 4.1 更新 `templates/skills-codex/apply.md`：第 37、38 行 `~/.ly/config.toml` 改为 `~/.codex/lyx/config.toml`。
- [ ] 4.2 更新 `templates/skills-codex/review-code.md`：第 56、57 行 `~/.ly/config.toml`、`~/.ly/prompts/codex/reviewer.md` 改为 `~/.codex/lyx/config.toml`、`~/.codex/lyx/prompts/codex/reviewer.md`。
- [ ] 4.3 更新 `templates/skills-codex/review-plan.md`：第 58、59 行 `~/.ly/config.toml`、`~/.ly/prompts/codex/plan-reviewer.md` 改为对应 `~/.codex/lyx/...` 路径。
- [ ] 4.4 更新 `templates/skills-codex/propose.md`：第 24、34、41 行的 worktree 路径示例 `~/.ly/worktrees/...` 改为 `~/.codex/lyx/worktrees/...`。
- [ ] 4.5 更新 `templates/skills-codex/worktree.md`：`description` 字段（第 3 行）与正文（第 49、84、131、156、159 行）中的 `~/.ly/worktrees/` 改为 `~/.codex/lyx/worktrees/`。
- [ ] 4.6 更新 `templates/CLAUDE.md`：第 14、28 行的 `~/.ly/prompts/codex/`、`~/.ly/worktrees/<项目名>/` 改为 `~/.codex/lyx/...`。
- [ ] 4.7 验证以上 6 个模板文件安装后生效：运行 `lycx init --force`（或对应的安装测试）后检查生成的 `~/.agents/skills/lyx-*/SKILL.md` 中角色词绝对路径确为 `~/.codex/lyx/...`；或直接 `grep -rn "~/.ly[^x]" templates/` 确认模板目录下无遗留（注意排除误匹配 `~/.lyx` 本身，用 `~/.ly[^x]` 或 `~/\.ly/` 排除后缀 x 的情况）。

## 5. 测试更新（安装器路径断言）

- [ ] 5.1 更新 `src/utils/__tests__/host-adapters.test.ts` 中对 `~/.ly/prompts/codex/...` 路径的断言（第 60、213 行附近）改为 `~/.codex/lyx/prompts/codex/...`；更新第 251-260 行附近"卸载"相关注释与测试对 `lyDir`/`sharedPromptsDir` 变量的构造（`join(base, '.ly')` 改为 `join(base, '.codex', 'lyx')`）。验证：`npm test -- host-adapters.test.ts` 通过。
- [ ] 5.2 新增/更新针对任务 3.1 新行为的测试用例（在 `host-adapters.test.ts` 或专门的 installer 测试文件中）：覆盖三种场景——(a) `worktrees/` 不存在或为空 → 整个 `~/.codex/lyx/` 被删除；(b) `worktrees/` 下存在一个有效 git worktree（用临时目录 `git init` + `git worktree add` 构造）→ `config.toml`/`prompts/` 被删，`worktrees/` 保留并输出警告；(c) `worktrees/` 下的子目录已不是有效 worktree（如原仓库已删除）→ 视为可删除，整体清理。验证：新增测试通过。
- [ ] 5.3 检查 `src/utils/__tests__/legacy-cleanup.test.ts` 是否有依赖旧 `~/.ly` 路径的断言（该文件主要覆盖 `~/.codex/` 侧清理，预期无关，但需确认）；若有则同步更新。验证：`npm test -- legacy-cleanup.test.ts` 通过。

## 6. 项目文档更新

- [ ] 6.1 更新 `AGENTS.md`：第 25-27、41、47、66、76、79、93-95、107、116、125 行的 `~/.ly` 路径全部改为 `~/.codex/lyx`；第 47、107 行提及 `migrateLegacyConfig` 的描述改为如实说明"不再做旧路径迁移"；第 107 行整段关于"旧配置自动迁移"的描述删除或改写为"不迁移，全新开始"。验证：`grep -n "~/.ly[^x]\|migrateLegacyConfig" AGENTS.md` 无输出（且未出现误改 `~/.codex/lyx` 为其他形式）。
- [ ] 6.2 更新 `README.md`：第 16-18、53、63 行的 `~/.ly` 路径改为 `~/.codex/lyx`；第 17、63 行提及"自动从旧 ~/.claude/.ly/config.toml 迁移"的描述删除或改写为"不迁移"。验证：`grep -n "~/.ly[^x]" README.md` 无输出。
- [ ] 6.3 更新根目录 `CLAUDE.md`：第 11、22、47 行的 `~/.ly` 路径改为 `~/.codex/lyx`；第 22 行"自动从旧 ~/.claude/.ly/config.toml 迁移"描述删除或改写。验证：`grep -n "~/.ly[^x]" CLAUDE.md` 无输出。
- [ ] 6.4 检查 `README.md` "与 ly-workflow 的关系" 一节（约第 59-64 行）：更新"共存/迁移路径"描述，明确说明本次改动后 ly-workflow-codex 的配置目录已与 ly-workflow 彻底解耦，不再有任何自动迁移；`~/.ly/` 下的旧文件（若存在）不受影响、不被读取。验证：人工核对该节文字与本 change 的实际行为一致。

## 7. 全量收尾验证

- [ ] 7.1 全仓库扫描确认无遗留：`grep -rn "~/\.ly[^x]\|~/\.ly$\|migrateLegacyConfig\|hasCoexistingLegacyLyProducts\|共享命名空间" src/ templates/ AGENTS.md README.md CLAUDE.md` 只应命中本 change 未覆盖到的合理例外（如 openspec/specs/ 下未被本次 Modified Capability 覆盖的历史文本——需人工确认属于范围外，不属于遗漏）。
- [ ] 7.2 运行完整测试套件与类型检查（如 `npm test` / `npm run typecheck` / `npm run build`，以项目实际脚本为准），全部通过。
- [ ] 7.3 手动验证一次端到端安装：在临时 `HOME`（或测试专用环境变量注入）下运行 `lycx init`，确认生成 `~/.codex/lyx/config.toml`、`~/.codex/lyx/prompts/codex/{reviewer,plan-reviewer}.md`；确认 `~/.ly/`（若测试环境中预先放置了旧文件）保持原样未被触碰。
- [ ] 7.4 运行 `openspec validate --changes migrate-ly-dir-to-codex-lyx` 确认 3 份 delta spec 结构合法。
