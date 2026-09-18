## ADDED Requirements

### Requirement: 生命周期命令自动提交使用增强正文

`/ly:init`、`/ly:apply`、`/ly:archive` 与 `/ly:propose` 生成的自动提交 SHALL 按 `commit-conventions` 的“lyx 生成提交统一复用 `@lyx-commit` 正文规范”生成 message 正文。change 生命周期命令（apply/archive/propose 阶段 commit）SHALL 在正文后追加既有 change trailer；非 change 生命周期提交（init、propose WIP）SHALL 遵守正文规范但不追加 `Change-Stage` / `Change-Name` trailer。

#### Scenario: init 提交包含正文
- **WHEN** `/ly:init` 生成 AGENTS.md 与 `openspec/` 初始化产物并提交
- **THEN** commit message 包含动机、改动、影响正文，且不携带 `Change-Stage` / `Change-Name` trailer

#### Scenario: apply 提交包含实施正文
- **WHEN** `/ly:apply` 完成实施并提交本次实际改动
- **THEN** commit message 在既有 apply trailer 之前包含实施要点、验证或风险说明

#### Scenario: archive 提交包含归档正文
- **WHEN** `/ly:archive` 完成归档并提交 `openspec/` 下文件移动
- **THEN** commit message 在既有 archive trailer 之前包含归档对象与 spec 同步说明

#### Scenario: propose WIP 提交包含正文
- **WHEN** `/ly:propose` 创建 WIP commit 暂存切分支前的工作区改动
- **THEN** commit message 包含动机、改动、影响正文，但不携带 `Change-Stage` / `Change-Name` trailer
