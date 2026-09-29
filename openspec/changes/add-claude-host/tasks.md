## 1. core 解耦（保持 codex 行为不变）

- [ ] 1.1 把 `src/utils/host-adapters.ts` 的宿主集合从类型写死改为按注册表登记（`ADAPTERS` 可扩展，适配器契约不变）；验证 `pnpm typecheck` 通过且既有 `host-adapters` 测试仍绿。
- [ ] 1.2 去掉 `src/utils/installer.ts` 中两处对 `ADAPTERS.codex` 的直接取值（安装与卸载各一处），改为按传入的宿主集合遍历；验证既有 `installer` 测试通过且单宿主调用产物与改造前一致。
- [ ] 1.3 把 `src/utils/installer.ts` 中 codex 专属的 `installPromptFiles` 迁入 codex 适配器的 `installExtras` 钩子（该钩子已在接口上，当前未被使用）；验证 codex 安装仍产出角色词文件，且测试断言安装产物清单不变。
- [ ] 1.4 把 `src/utils/installer-template.ts` 的 `injectConfigVariables` 收敛为通用替换，codex 语义（`{{REVIEWER_MODEL}}` 渲染、`LY:IF:IMPLEMENTER_*` 折叠）迁入 codex 适配器的渲染函数；验证既有 `injectConfigVariables` 测试通过。
- [ ] 1.5 给安装结果结构加入宿主维度（保留既有字段以免破坏调用方）；验证 `installer` 测试覆盖"多宿主分别记录安装结果"。

## 2. codex 宿主包抽取

- [ ] 2.1 新建 `src/hosts/codex/`（适配器、路径常量、配置 schema、模板目录、角色词目录），把 codex 专属路径常量与适配器实现迁入；验证 `pnpm typecheck` 与既有全部测试通过。
- [ ] 2.2 精简 `src/utils/package-meta.ts` 为包级常量（包名、二进制名、仓库地址等），验证 `rg` 检索 `src/utils` 下不再出现任何宿主专属路径常量。
- [ ] 2.3 把 `templates/skills-codex/` 与 `templates/prompts/codex/` 迁入 codex 宿主包；验证安装后的产物路径与文件清单同迁移前逐项一致（对比改造前的产物清单）。

## 3. 每宿主配置文件

- [ ] 3.1 `src/utils/config.ts` 改为按宿主读写（读、写、取路径均带宿主维度），并新增"列出已安装宿主"（扫描各宿主配置文件是否存在）；验证配置测试覆盖两宿主配置互不覆盖。
- [ ] 3.2 宿主配置节归一为不带宿主名的统一节，并实现历史节名的兼容读取（含下次写入时归一）；验证断言：含历史节名的配置读取后字段取值与重写后取值一致。
- [ ] 3.3 移除"已安装宿主集合"持久化字段，读取时忽略历史取值；验证断言：历史取值与磁盘配置文件不一致时以磁盘为准。
- [ ] 3.4 `src/index.ts` 的三个无参路径函数保留签名、内部默认 codex 并标注 deprecated，新增按宿主取值的替代函数；验证对外导出类型完整、既有调用方编译通过。

## 4. Claude 宿主包

- [ ] 4.1 新建 `src/hosts/claude/`（适配器、路径常量、配置 schema、子代理定义目录、模板目录）；验证 `pnpm typecheck` 通过且注册表可枚举到该宿主。
- [ ] 4.2 在该宿主适配器的渲染阶段实现命令前缀改写（`@lyx-` → `/lyx-`）；验证渲染快照断言：claude 产物用斜杠前缀、codex 产物保持原前缀。
- [ ] 4.3 新增 Claude 侧审查与实施子代理定义：只读审查工具集、默认继承会话模型与推理档、明确不启用 worktree 隔离；验证定义文件 frontmatter 合法且断言覆盖上述三条。
- [ ] 4.4 把 `review-plan.md` / `review-code.md` / `apply.md` / `propose.md` 中的宿主分歧段落抽成宿主片段，由渲染阶段注入；验证 codex 侧产物与迁移前逐字一致（逐文件比对）。

## 5. init 向导与 CLI

- [ ] 5.1 `lycx init` 增加宿主多选步骤，默认按 `~/.codex` 与 `~/.claude` 是否存在勾选；验证 `init` / `menu` 测试覆盖默认勾选与取消其一。
- [ ] 5.2 非交互路径（`--skip-prompt`）以磁盘上已存在的宿主配置文件集合为安装集合；验证 `update` 测试覆盖"只有 claude 配置时不擅自创建 codex"。
- [ ] 5.3 Claude 侧向导不采集 provider 与模型、不写入宿主 provider 配置（子代理默认继承），并在摘要中如实呈现；验证断言：claude 路径不产生 provider 写入动作。
- [ ] 5.4 更新中英文文案与 CLI help（宿主选择、分宿主安装结果、配置路径展示）；验证 `pnpm typecheck` 通过且文案断言覆盖两种语言。

## 6. OpenSpec 集成按宿主

- [ ] 6.1 `src/utils/preflight.ts` 的技能扫描根按已安装宿主展开（补 claude 侧项目级与全局技能根）；验证 `preflight` 测试覆盖"仅 claude 宿主已安装时判为就绪而非缺失"。
- [ ] 6.2 项目级修复命令由固定 `--tools codex` 改为按缺失技能的宿主执行 `openspec init --tools <宿主>`（必要时以 `openspec update --force` 刷新）；验证 `preflight` 测试断言修复命令取值随宿主变化。
- [ ] 6.3 `lycx openspec inspect` / `ensure` 接收宿主集合入参并以宿主集合为扫描与修复依据；验证 CLI 层测试覆盖两宿主与单宿主两种调用。
- [ ] 6.4 项目初始化模板按宿主渲染：claude 宿主下额外产出导入 `AGENTS.md` 的 `CLAUDE.md`，提交文件清单与汇总同步；验证模板断言覆盖 claude 侧产出规则与 codex 侧无该产出。

## 7. 运维命令遍历宿主

- [ ] 7.1 `lycx uninstall` 按宿主界定范围并支持单宿主卸载，且不删除 OpenSpec 自有产物；验证测试覆盖"卸载 claude 不动 codex"与"OpenSpec 产物原样保留"。
- [ ] 7.2 `lycx doctor` 分宿主输出（codex 查命令与角色词，claude 查命令与子代理定义）；验证 `doctor` 测试覆盖两宿主同时安装与只装其一。
- [ ] 7.3 `lycx status` 与交互菜单按宿主展示已安装命令与配置路径；验证 `menu` 测试覆盖分宿主展示。
- [ ] 7.4 `lycx update` 只刷新已安装宿主；验证 `update` 测试覆盖"版本一致的宿主不被改写，落后的宿主被刷新"。

## 8. 测试遍历宿主

- [ ] 8.1 把 `src/utils/__tests__/host-adapters.test.ts` 中"所有宿主共有"的断言改为遍历注册表执行（提交正文与 trailer、审查分级口径、实施软上下文引用、快照纪律）；验证任一宿主缺失不变量时测试失败，且新增宿主自动纳入覆盖。
- [ ] 8.2 新增多宿主安装与卸载测试：安装集合选择、单宿主卸载不影响另一宿主、安装结果按宿主记录；验证 `pnpm test` 通过。
- [ ] 8.3 新增 Claude 宿主专属测试：命令前缀渲染、子代理定义合法性与默认继承、不写 provider 配置、不触碰 OpenSpec 产物；验证 `pnpm test` 通过。

## 9. 打包登记

- [ ] 9.1 在 `package.json` 的 `files` 字段登记本次新增的模板与宿主包目录；验证 `npm pack --dry-run` 的输出包含全部模板目录且无遗漏（对照源目录清单）。

## 10. 文档同步

- [ ] 10.1 更新 `README.md` 与 `README.zh-CN.md`：新增宿主说明、安装方式、两条审查路径（main 基线 / subagent 可选）与宿主边界；验证两份文档均出现等价描述。
- [ ] 10.2 更新 `CLAUDE.md` 与 `templates/CLAUDE.md`：模块职责与模板导航反映宿主包目录结构；验证两份文档的目录描述与代码实际结构一致。
- [ ] 10.3 更新 `workflow.md`：开头写死的单宿主描述改为按宿主界定；验证文中不再出现单宿主限定表述。
- [ ] 10.4 更新 `AGENTS.md`：架构章节反映多宿主与每宿主配置；验证文中"单宿主"表述已按现状修正（`CHANGELOG.md` 按仓库约定留到发版，本次不改）。

## 11. 结构与整体验证

- [ ] 11.1 运行 `openspec validate --changes add-claude-host --strict`，确认 change artifacts 结构合法。
- [ ] 11.2 运行 `pnpm typecheck && pnpm build && pnpm test`，确认全绿；并核实 codex 宿主安装产物与本次改造前逐项一致。
