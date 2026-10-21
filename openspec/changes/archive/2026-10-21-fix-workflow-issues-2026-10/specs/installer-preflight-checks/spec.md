## ADDED Requirements

### Requirement: OpenSpec root 必须位于当前项目顶层之下

`lycx openspec inspect|ensure`、`@lyx-init` 与安装器 preflight 共用的 root 判定 SHALL 在 `openspec doctor` 报 healthy 之后，额外校验 `root.path` 是否位于当前项目顶层之下：项目顶层取 `git rev-parse --show-toplevel`（成功时），否则取当前工作目录；`root.path` 等于项目顶层或位于其下为通过，位于其外（含 `$HOME` 兜底 root）SHALL 判为 `outside-project`，SHALL NOT 判为 healthy。

`ensure` 在 `allowWrite` 为真时 SHALL 像处理 `missing` 一样提供并执行 `init-root`（在项目内 `openspec init`）；`allowWrite` 为假或用户拒绝时 SHALL 只报告 `outside-project` 并给出 `openspec init` 的可执行指引，SHALL NOT 把该状态当作 healthy 继续。

#### Scenario: 家目录兜底 root 被识别为 outside-project

- **WHEN** 当前项目位于 `/Users/ly/codes/x`，`openspec doctor` 返回 healthy 且 `root.path = /Users/ly`
- **THEN** root 判定为 `outside-project`，SHALL NOT 判 healthy，报告提示在项目内运行 `openspec init`

#### Scenario: 项目内 root 仍判 healthy

- **WHEN** 当前项目位于 `/Users/ly/codes/x`，`root.path = /Users/ly/codes/x`
- **THEN** root 判定为 healthy

#### Scenario: ensure 可写时修复 outside-project

- **WHEN** root 为 `outside-project` 且 `ensure` 的 `allowWrite` 为真、用户确认
- **THEN** 在项目内执行 `openspec init`（等价 init-root），随后重新检查 root 判定
