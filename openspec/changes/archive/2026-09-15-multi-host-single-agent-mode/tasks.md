## 1. 前置验证

- [x] 1.1 codex custom prompt 传参验证：静态验证 argument-hint frontmatter 机制 + opsx-*.md 现网佐证（探索阶段）；codex TUI 交互实测留人工验收（apply 报告已注明）

## 2. HostAdapter 抽象与 claude 收敛

- [x] 2.1 新建 `src/utils/host-adapters.ts`：HostAdapter 接口（id/promptsTarget/renderTemplate/uninstallList）+ 注册表；claude adapter 实现（现有 installDir/渲染行为收敛入接口，行为零变化）
- [x] 2.2 installer.ts 主流程改造：按宿主选择遍历适配器执行安装，移除安装流程中的硬编码宿主分支；既有 vitest 全绿（claude 行为回归断言）

## 3. codex 适配器与单 Agent 模板

- [x] 3.1 新建 `templates/commands-codex/`：14 个单 Agent 版命令模板（argument-hint frontmatter；从 claude 版逐文件派生：删 wrapper/委托/ OVERALL 段落，审查命令改 `codex exec -C "$WORKDIR" --json -m {{REVIEW_MODEL}} -` + `codex exec --json resume <session-id> -` 循环形态，apply 改当前会话自实施）
- [x] 3.2 codex adapter 实现：renderTemplate（injectConfigVariables + REVIEW_MODEL 渲染）、promptsTarget（~/.codex/prompts/ly-*.md）、uninstallList（ly-*.md）
- [x] 3.3 vitest：codex adapter 渲染（REVIEW_MODEL 注入、无 wrapper 残留）、安装产物路径、卸载清单

## 4. prompts 位置中立化

- [x] 4.1 installer 写入点改 `~/.ly/prompts/`（新常量）；init/update 迁移逻辑（旧 ~/.claude/.ly/prompts/ → 新位置 → 旧目录清理，失败报告不阻断）；config.paths.prompts 字段更新
- [x] 4.2 命令模板 ROLE_FILE 路径全量更新（claude 版 + codex 版）；installer-template 路径替换规则同步
- [x] 4.3 codex 侧角色词机制（不建软链）：codex adapter 安装完成后校验 ROLE_FILE 目标（~/.ly/prompts/codex/ 等）存在，缺失则报安装错误
- [x] 4.4 legacy-cleanup 补旧位置清理项；卸载按宿主分离（claude uninstall 不删 ~/.ly/prompts，codex uninstall 只删自身产物）；整体卸载（全部宿主产物均已卸载）时清理 ~/.ly/prompts；vitest 断言三态：卸 claude 保留 / 卸 codex 保留 / 全卸清理

## 5. preflight 宿主化

- [x] 5.1 `src/utils/preflight.ts` 宿主化改造：技能检测路径按宿主集合确定（claude 侧 ~/.claude 技能 / codex 侧 ~/.codex/prompts/opsx-*）；默认动作与 menu 入口双侧都查并按缺侧提示，init 在宿主选择步骤后补检所选宿主侧；CLAUDE_CONFIG_DIR 兼容保持；vitest 补宿主化判定断言

## 6. init/menu 交互

- [x] 6.1 init 向导加宿主选择步骤（claude/codex/both，默认 claude）；仅 codex 时跳过 claude 专属步骤（审查后端/实施后端/性能设置），采集 codexHost.reviewModel；both 时全流程
- [x] 6.2 menu 重组（Claude Code 组并入"工作流"，其他工具加 X. 安装 Codex 独立安装 codex 宿主）；模型路由入口增 review_model 子项；vitest 补菜单结构断言
- [x] 6.3 配置扩展：LyConfig.codexHost.reviewModel 读写与校验（config.ts + 类型）

## 7. 文档与验收

- [x] 7.1 根 CLAUDE.md（模块职责/命令表宿主语义/菜单结构）、README 双宿主说明；i18n 新增文案（zh/en）
- [x] 7.2 `pnpm typecheck && pnpm build && pnpm test` 全绿
- [x] 7.3 实装验证（可自动化部分）：程序化安装测试覆盖 codex/both 场景产物正确（host-adapters.test.ts）、claude 侧行为回归（171 tests 全绿）；真实 init 与 codex TUI /ly:explore 实测留人工验收

## 8. 追加细化：init 向导 codex 分支四级采集（2026-09-10）

- [x] 8.1 新建 `src/utils/codex-provider.ts`：config.toml 读取/解析（smol-toml，失败空列表）、自定义 provider 增量写入（文本合并保注释，块存在不重复写，写回 parse 自检）、GET {base_url}/models 拉取（OpenAI 兼容，10s 超时，失败带原因）
- [x] 8.2 init 向导 Step 0.5 重排：宿主选择升级"工作流模式"三选一（内部宿主集合语义不变）；单 Agent 模式走 Agent 选择（仅 Codex 一项仍展示列表）→ API 提供方（已有 provider/OpenAI 官方/自定义）→ 模型（动态列表/失败回退输入）；both 同样采集但跳过 Agent 列表；claude 分支流程不动；skip-prompt 语义不变
- [x] 8.3 vitest：sanitizeProviderName、listModelProviders（解析/缺失/坏文件）、upsertModelProvider（新建/追加保注释/已存在不重复写/顶层键原位替换与文件头插入/写回 parse 合法）、fetchCodexModels（成功去重/HTTP 失败/网络失败/非标响应/裸数组）；全量测试零回归
- [x] 8.4 i18n 双语新增 init:mode.* 文案；delta spec 落 codex-single-agent-mode（ADDED：init 向导工作流模式与 codex 宿主四级采集）
