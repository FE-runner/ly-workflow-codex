# Context: move-lyx-state-to-run-state

## 核心决策

- `.openspec.yaml` 只保留 OpenSpec 官方字段。不使用 `x-lyx:`；所有新 lyx 状态进入 `run-state.md`。
- run-state 采用稳定英文 YAML frontmatter 作为机器状态权威，Markdown 正文只放本地语言说明和证据。正文冲突时以 frontmatter 为准并记录异常。
- `testMode=ask` 在 artifacts 生成前只存在于当前会话；change 名确认并创建 run-state 后立即持久化，之前的进程中断允许重新询问。
- 旧 change 的 `.openspec.yaml lyx:` 只读，不迁移、不批量处理、不写回。新字段优先；无 YAML frontmatter 的旧 run-state 触发旧格式兼容。

## 范围边界

- 本次不新增 CLI、运行时解析器或独立 `lyx-state.yaml`。
- 本次不移除旧 `lyx:` 读取；移除兼容属于后续 breaking change。
- 本次不改写任何存量活跃或归档 change，包括本仓库已有 21 份归档 `lyx:` 元数据。
- 本次不改变 archive 的 Git 安全校验和“不自动 push”规则。

## 已否决备选

- 使用 `.openspec.yaml x-lyx:`：虽然符合 OpenSpec 扩展键规则，但继续把执行状态放在 OpenSpec 文件中，并保留双状态源，否决。
- 使用独立 `lyx-state.yaml`：需要新增文件、解析逻辑与双文件一致性问题，现有 run-state 已覆盖该职责，否决。
- 自动迁移旧 change：会产生历史和无关 diff，并可能丢失未知字段，否决。

## 已知坑

- 新 run-state 一旦存在 frontmatter 但结构损坏，必须停止；不能悄悄回退旧 `.openspec.yaml`，否则可能使用过期状态继续执行。
- legacy `.openspec.yaml` 只适用于“完全没有 YAML frontmatter”的旧 run-state；新 change 缺少字段时应按缺失处理并写 run-state。
- run-state 会被后续 apply/review/archive 增量更新，修改时必须保留 frontmatter 与既有证据，不能整文件重写。
- 归档后 run-state 的路径位于 `openspec/changes/archive/<date>-<change>/run-state.md`，分支收尾要读取新路径。
- 实施时为让 lint 聚焦代码，`eslint.config.mjs` 新增忽略 `openspec/**`；OpenSpec 规范文件由 `openspec validate` 校验。未修改任何存量 active 或 archive change。
- 真实行为评测新增 `apply-legacy-compat`；baseline/current 共 10 单元，9 passed，唯一失败是预期 baseline `review-plan`，current 5/5 全部通过。
