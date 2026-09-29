## 1. core 解耦（保持 codex 行为不变）

- [ ] 1.1 把 `src/utils/host-adapters.ts` 的宿主集合从类型写死改为按注册表登记；保持既有调用语义不变，允许为适配器扩展只读能力（如默认探测目录、技能根，供 5.1/6.1 使用）；验证 `pnpm typecheck` 通过且既有 `host-adapters` 测试仍绿。
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
- [ ] 4.4 把 `review-plan.md` / `review-code.md` / `apply.md` / `propose.md` 中的宿主分歧段落抽成宿主片段，由渲染阶段注入，其中含 codex 角色词绝对路径（该路径不得进入 Claude 产物，Claude 侧角色设定来自子代理定义正文）；验证 codex 侧产物与迁移前逐字一致（逐文件比对），且 Claude 产物中 `rg` 检索不到 codex 角色词路径。

## 5. init 向导与 CLI

- [ ] 5.1 `lycx init` 增加宿主多选步骤，默认勾选由各宿主适配器暴露的探测目录决定（共享 CLI 不硬编码任何宿主目录）；验证 `init` / `menu` 测试覆盖默认勾选与取消其一，且断言共享层无宿主专属路径字面量。
- [ ] 5.2 非交互路径（`--skip-prompt`）以磁盘上已存在的宿主配置文件集合为安装集合；验证 `update` 测试覆盖"只有 claude 配置时不擅自创建 codex"。
- [ ] 5.3 Claude 侧向导不采集 provider 与模型、不写入宿主 provider 配置（子代理默认继承），并在摘要中如实呈现；验证断言：claude 路径不产生 provider 写入动作。
- [ ] 5.4 更新中英文文案与 CLI help（宿主选择、分宿主安装结果、配置路径展示）；验证 `pnpm typecheck` 通过且文案断言覆盖两种语言。

## 6. OpenSpec 集成按宿主

- [ ] 6.1 `src/utils/preflight.ts` 的技能扫描根改为按已安装宿主从各适配器取（共享 preflight 不硬编码宿主技能根，补 claude 侧项目级与全局技能根）；验证 `preflight` 测试覆盖"仅 claude 宿主已安装时判为就绪而非缺失"、"无任何宿主配置时取全部已注册宿主"。
- [ ] 6.2 项目级修复命令由固定 `--tools codex` 改为按缺失技能的宿主执行 `openspec init --tools <宿主>`（必要时以 `openspec update --force` 刷新）；验证 `preflight` 测试断言修复命令取值随宿主变化。
- [ ] 6.3 `lycx openspec inspect` / `ensure` 接收宿主集合入参并以宿主集合为扫描与修复依据；验证 CLI 层测试覆盖两宿主与单宿主两种调用。
- [ ] 6.4 项目初始化模板按宿主渲染：claude 宿主下额外产出导入 `AGENTS.md` 的 `CLAUDE.md`，提交文件清单与汇总同步；验证模板断言覆盖 claude 侧产出规则与 codex 侧无该产出。
- [ ] 6.5 编排写入型修复的执行时机：无任何宿主配置文件时先只读诊断，宿主选择确认后按用户所选宿主集合执行项目级修复；验证测试覆盖"全新环境首次 init 不写入任何宿主产物"与"确认宿主后按所选集合写入（不写未选宿主）"。

## 7. 运维命令遍历宿主

- [ ] 7.1 `lycx uninstall` 按宿主界定范围并支持单宿主卸载，且不删除 OpenSpec 自有产物；验证测试覆盖"卸载 claude 不动 codex"与"OpenSpec 产物原样保留"。
- [ ] 7.2 `lycx doctor` 分宿主输出命令产物检查（codex 查命令与角色词，claude 查命令与子代理定义）；验证 `doctor` 测试覆盖两宿主同时安装与只装其一。
- [ ] 7.3 `lycx doctor` 的子代理配置检查项按宿主展示执行者字段与子代理定义侧的取值来源（继承 / 已指定），claude 宿主未采集模型时不报缺失错误，并检测配置与已安装定义不一致；验证 `doctor` 测试覆盖"继承标注为继承而非缺失"与"配置变更后提示不一致"。
- [ ] 7.4 `lycx status` 与交互菜单按宿主展示已安装命令与配置路径；验证 `menu` 测试覆盖分宿主展示。
- [ ] 7.5 `lycx update` 只刷新已安装宿主，并按当前配置重渲该宿主的子代理定义；验证 `update` 测试覆盖三种情形：版本一致且定义无偏差时不重渲、版本落后时刷新、版本一致但定义与配置有偏差时仍重渲。
- [ ] 7.6 为 `uninstall` / `doctor` / `status` / `update` 补上单宿主选择的用户入口（交互选择或显式参数）与"未指定即全部已安装宿主"的默认；验证测试覆盖显式指定单宿主与不指定两种调用。

## 8. 测试遍历宿主

- [ ] 8.1 把 `src/utils/__tests__/host-adapters.test.ts` 中"所有宿主共有"的断言改为遍历注册表执行（提交正文与 trailer、审查分级口径、实施软上下文引用、快照纪律）；验证任一宿主缺失不变量时测试失败，且新增宿主自动纳入覆盖。
- [ ] 8.2 新增多宿主安装与卸载测试：安装集合选择、单宿主卸载不影响另一宿主、安装结果按宿主记录；验证 `pnpm test` 通过。
- [ ] 8.3 新增 Claude 宿主专属测试：命令前缀渲染、子代理定义合法性与默认继承、不写 provider 配置、不触碰 OpenSpec 产物；验证 `pnpm test` 通过。

## 9. 打包登记

- [ ] 9.1 在 `package.json` 的 `files` 字段登记本次新增的模板与宿主包目录，并清理因模板目录迁移而失效的旧路径条目；验证 `npm pack --dry-run` 的输出与迁移后的源目录集合精确一致（无遗漏、无失效条目），并补一条测试断言"包内模板目录集合与源目录集合一致"。

## 10. 文档同步

- [ ] 10.1 更新 `README.md` 与 `README.zh-CN.md`：新增宿主说明、安装方式、两条审查路径（main 基线 / subagent 可选）与宿主边界；验证两份文档均出现等价描述，且描述与 delta spec 的 Requirement 逐条对得上（不是只检查措辞出现）。
- [ ] 10.2 更新 `CLAUDE.md` 与 `templates/CLAUDE.md`：模块职责与模板导航反映宿主包目录结构；验证两份文档的目录描述与代码实际结构逐项一致。
- [ ] 10.3 更新 `workflow.md`：开头写死的单宿主描述改为按宿主界定；验证文中不再出现单宿主限定表述，且流程描述与 `claude-host` 的可见行为一致。
- [ ] 10.4 更新 `AGENTS.md`：架构章节反映多宿主与每宿主配置；验证文中"单宿主"表述已按现状修正，并与 `multi-host-install` 的 Requirement 一致（`CHANGELOG.md` 按仓库约定留到发版，本次不改）。

## 11. 结构与整体验证

- [ ] 11.1 运行 `openspec validate --changes add-claude-host --strict`，确认 change artifacts 结构合法。
- [ ] 11.2 运行 `pnpm typecheck && pnpm build && pnpm test`，确认全绿；并核实 codex 宿主安装产物与本次改造前逐项一致。
