## Purpose

codex 单 Agent 模式的端到端契约：codex CLI 作为宿主承载 /ly:* 编排命令（~/.codex/prompts/ custom prompt 形态），单 Agent 编排（propose → review 独立子会话 → 循环清零 → apply 当前会话自实施），模型角色以 review_model 配置 + `codex exec -m` 区分。claude 宿主的双角色工作流不受本能力影响。

## ADDED Requirements

### Requirement: codex 宿主命令安装形态
codex 适配器必须（SHALL）将 14 个 /ly:* 命令的单 Agent 版模板以 codex custom prompt 形态安装到 `~/.codex/prompts/ly-*.md`（含 `argument-hint` frontmatter；用户输入的参数进入模型上下文）。单 Agent 版模板必须（SHALL）与 claude 版内容分离维护：无 ly-wrapper 调用、无 OVERALL 解析、无 routing.implementer 委托分支，编排指示面向 codex 会话自身。命令模板本体 SHALL NOT 使用软链。

#### Scenario: codex 会话内调用审查命令
- **WHEN** 用户在 codex TUI 中运行 `/ly:review-plan <change-name>`
- **THEN** custom prompt 的参数（change 名）进入上下文，按单 Agent 编排指示执行方案审查

### Requirement: review_model 配置与审查子会话
配置必须（SHALL）提供 `codexHost.reviewModel` 字段（init 向导与 ly menu 均可设置）。codex 版审查命令（review-plan/review-code）的自动审查关卡必须（SHALL）渲染为 `codex exec -C "$WORKDIR" --json -m {{REVIEW_MODEL}} -` 形态（与 ly-wrapper 已验证的 codex 参数构造对齐：-C 工作目录、--json JSONL 事件流、`-` 从 stdin 读 prompt）——独立子会话（无当前会话上下文）+ 指定模型；循环复审必须（SHALL）用 `codex exec --json resume <session-id> -` 续聊；审查会话 SESSION_ID 按 JSONL 事件 `session_id` 字段首现值提取。未配置 reviewModel 时 SHALL 回退为当前会话模型（exec 不带 -m），并在安装汇总中提示。

#### Scenario: 自动审查关卡按配置模型起子会话
- **WHEN** 配置 reviewModel=gpt-x 后运行 /ly:review-plan
- **THEN** 审查在 `codex exec -C "$WORKDIR" --json -m gpt-x` 的独立子会话中执行，结论回到当前会话做 Critical 判定与修复循环

#### Scenario: coding 模型即当前会话
- **WHEN** 用户在 codex TUI 中以任意模型启动会话做开发
- **THEN** apply 阶段由当前会话自实施（无委托分支），不读取任何实施后端配置

### Requirement: codex 宿主不涉及双角色机制
codex 单 Agent 模式必须（SHALL）SHALL NOT 读取/写入 `routing.implementer`，SHALL NOT 调用 ly-wrapper，SHALL NOT 启动审查进度 Web UI（liteMode/Web UI 机制为 claude 宿主专属；选 both 宿主时 init 仅对 claude 分支询问该步骤）。init 的 claude 专属步骤（审查后端/实施后端选择）在仅选 codex 宿主时必须（SHALL）跳过。

#### Scenario: 仅 codex 宿主的 init 向导裁剪
- **WHEN** 用户在 init 宿主选择中仅选 codex
- **THEN** 向导跳过"选择审查后端""选择实施后端""性能设置（Web UI）"三个 claude 专属步骤，采集 language 与 codexHost.reviewModel 后完成安装

### Requirement: init 向导工作流模式与 codex 宿主四级采集
init 向导（交互模式）必须（SHALL）以"工作流模式"三选一替换原"宿主选择"步骤的措辞与结构：多 Agent 模式（内部宿主集合 ['claude']）/ 单 Agent 模式（['codex']）/ 两者都装（['claude','codex']）——内部宿主集合语义不变。选择单 Agent 模式后必须（SHALL）展示 Agent 选择列表（当前仅 Codex 一项并标注"当前可用"，仅一项时仍展示列表，为未来宿主留位），随后展示 API 提供方列表：①解析 ~/.codex/config.toml 现有 [model_providers.*] 条目（smol-toml parse，失败则按空列表处理不报错）+ ②OpenAI 官方 + ③自定义（输入名称/base_url/API key）。选自定义时必须（SHALL）以文本增量合并方式写入 config.toml 的 [model_providers.<name>] 块与顶层 model_provider——SHALL NOT parse+stringify 整文件重写（丢注释）；不存在的块追加到文件尾，已存在的块提示已存在直接选用、不重复写。模型选择必须（SHALL）动态拉取：GET {base_url}/models（OpenAI 兼容，10s 超时，key 取该 provider 的 env_key 对应环境变量或用户输入），成功则以列表展示模型 id；失败回退自由输入并提示原因；结果经 sanitizeReviewModel 写入 codexHost.reviewModel。skip-prompt 模式必须（SHALL）跳过上述 2-4 级（保持既有 skip 语义）。多 Agent 分支（claude 宿主）流程必须（SHALL）保持不变。

#### Scenario: 单 Agent 模式四级采集
- **WHEN** 用户在 init 向导选择"单 Agent 模式"
- **THEN** 依次经历 Agent 选择（仅 Codex）→ API 提供方（config.toml 已有 provider + OpenAI 官方 + 自定义）→ 模型（/models 动态列表或失败回退输入），结果写入 codexHost.reviewModel

#### Scenario: 自定义 provider 增量写入保注释
- **WHEN** 用户选择自定义 provider 且 ~/.codex/config.toml 已存在带注释内容
- **THEN** 新 [model_providers.<name>] 块追加到文件尾、原有注释逐行保留、顶层 model_provider 原位替换/插入、写回结果可被 smol-toml parse；同名块已存在时不重复写并提示直接选用

#### Scenario: 模型列表拉取失败回退
- **WHEN** 所选 provider 的 {base_url}/models 请求超时、非 2xx 或响应非 OpenAI 兼容形态
- **THEN** 提示失败原因并回退 inquirer input 自由输入模型名，不阻断流程

### Requirement: 菜单宿主语义重组
主菜单必须（SHALL）按宿主无关语义重组：原"Claude Code"独立组解散并入"工作流"组；其他工具组新增"安装 Codex"入口（单独安装/重装 codex 宿主产物）。菜单重组 SHALL NOT 改变既有入口的功能行为。

#### Scenario: 菜单重组后功能等价
- **WHEN** 用户在重组后的主菜单中使用原有功能（更新/配置API/模型路由/显示设置）
- **THEN** 各入口行为与重组前一致，仅分组与文案变化；"安装 Codex"可独立完成 codex 宿主安装
