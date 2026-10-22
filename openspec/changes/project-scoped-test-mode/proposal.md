## Why

现有 `testMode` 只按宿主保存，同一宿主下的所有项目被迫共用一种测试策略。用户需要在同一份宿主配置中按项目路径区分 `normal` / `off`，同时让同一仓库的子目录与 linked worktree 得到一致结果。

## What Changes

- 在宿主配置文件新增路径键项目覆盖表 `[projects."<主仓库根路径>"]`，当前只支持 `testMode` 字段；`[host].testMode` 保留为未命中项目时的默认值。
- 定义项目配置键解析：有 Git 时归一到主仓库根，子目录与 linked worktree 共用同一键；无 Git 时使用规范化后的当前目录。
- 项目键解析需区分普通 checkout、separate-git-dir、子模块、linked worktree、bare repository 上的 linked worktree 与无 Git 目录；bare 仓库没有主工作树根时回退到当前 worktree 根。
- 定义有效测试模式解析顺序：项目路径条目 > 宿主默认 `testMode` > `normal`。项目条目缺失或取值非法时回退宿主默认，并由 doctor 暴露非法形态。
- 新增 `lycx project test-mode normal|off` 与 `lycx project test-mode --unset`，按宿主写入 canonical 项目键，或从所有规范化等价的项目键中移除测试模式覆盖。
- 项目命令写入前 SHALL 预校验全部目标配置与规范化路径冲突；别名键指向同一项目且值冲突时失败且不写任何配置。
- `lycx init` / 菜单继续维护宿主默认 `testMode`，并明确其“未被项目覆盖时生效”的语义；`lycx doctor` / `status` 展示当前项目有效模式、来源与路径。
- `@lyx-fix`、`@lyx-propose`、`@lyx-apply`、`@lyx-review-plan`、`@lyx-review-code`、`@lyx-archive` 及双宿主审查角色词改为读取有效测试模式，不再只读宿主默认值。
- 配置重写、非交互重装与未触碰字段的编辑 SHALL 保留全部 `[projects]` 条目；任一所选宿主配置存在但不可读/TOML 非法时，`lycx init` / update SHALL 在写入任何宿主前停止并报告，不得以默认配置覆盖。本变更不自动迁移或改写已有路径键。
- 补齐配置、路径归一、CLI、doctor/status、双宿主模板契约与双语文档的静态检查、手工 smoke、typecheck 与 build 验证；当前有效 `testMode=off`，本 change 不新增或修改测试文件，也不生成测试命令任务。

## Capabilities

### New Capabilities

### Modified Capabilities

- `test-mode`: 将测试模式从仅宿主级默认值扩展为“项目路径覆盖 + 宿主默认值”的有效模式解析，并定义管理命令、展示、兼容与失败语义。

## Impact

- 配置类型与读写：`src/types/index.ts`、`src/utils/config.ts`
- 项目路径解析与有效模式：新增共享配置解析模块，并接入 doctor/status 与模板运行时读取约定
- CLI：`src/cli-setup.ts`、新增项目配置命令、i18n 文案与帮助信息
- 宿主体检：Codex / Claude doctor 的有效模式、来源与非法项目条目告警
- 工作流模板：`fix`、`propose`、`apply`、`archive`、`review-plan`、`review-code` 及 Codex / Claude 审查角色词
- 验证：配置读写、路径归一、CLI、双宿主 doctor 与模板的静态检查及手工 smoke
- 文档：`AGENTS.md`、`CLAUDE.md`、`README.md`、`README.zh-CN.md`、`templates/CLAUDE.md`
- 不改变测试模式取值集合、默认 `normal`、非测试质量门禁或 npm 发布流程
