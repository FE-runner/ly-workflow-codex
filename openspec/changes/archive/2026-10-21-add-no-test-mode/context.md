# No-test mode context

本 change 新增宿主级 `testMode = normal | off`。完整契约见 `specs/test-mode/spec.md`，此处只记录实施时容易混淆的边界。

## 关键决策

- `testMode` 按宿主生效；未配置、空白或非法值等价 `normal`，非法值由 doctor 告警。
- `off` 同时关闭测试文件新增/修改、测试任务生成和测试命令执行，不提供单次命令级覆盖参数。
- `@lyx-fix` 仅新增读取 `testMode` 的最小例外，仍不读取 review/coding 执行者或模型字段。
- `@lyx-propose` 不生成测试任务；`@lyx-apply` 对遗留测试专用任务显式跳过并留痕。
- review-plan / review-code 仅在 `off` 时抑制测试相关发现；核心行为、接口契约、安全、数据完整性等非测试门禁保持不变。
- `@lyx-archive` 在 `off` 时跳过 test，仍执行 typecheck/build，并明确标记测试被跳过。

## 实施约束

- 不修改项目 `package.json` 脚本、npm 发布 workflow 或 CI 测试配置。
- i18n 文案键必须 zh-CN / en 同步；双宿主 reviewer 判级标准继续保持逐字一致。
- `@lyx-fix` 允许出现且仅允许使用 `{{LYX_CONFIG_FILE}}` 读取 `testMode`，现有“无占位符”断言需收窄为“只允许该配置路径占位符”。
- 默认模式行为不变，不做配置迁移；回滚可移除 `testMode` 字段并恢复模板。

## 实施决策

- `HostAdapterConfig` 新增可选 `testMode`，使 Codex / Claude doctor 能在宿主无关上下文中读取该字段。
- 菜单入口文案改为“配置模式、执行者与模型”，明确 testMode 与 reviewMode 都从该入口维护。
- `@lyx-fix` 的模板占位符在安装期渲染为当前宿主 config.toml 绝对路径；断言对象是渲染后的命令文本，因此验证 `/lyx/config.toml` 而非原始 `{{LYX_CONFIG_FILE}}`。
- 无测试模式只影响 lyx 工作流行为；项目自身测试脚本、npm 发布 workflow 和 CI 测试配置保持原样。
