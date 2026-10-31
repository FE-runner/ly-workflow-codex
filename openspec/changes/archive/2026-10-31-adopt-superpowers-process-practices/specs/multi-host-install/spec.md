## ADDED Requirements

### Requirement: 安装与发布覆盖 skill references
安装器 SHALL 从共享 skill 源目录识别每个命令的 sidecar references，按目标宿主渲染宿主片段与路径变量，并复制到安装后的 `lyx-<command>/references/`。发布包 SHALL 包含共享 references 与各宿主 fragments，模板完整性测试 SHALL 防止遗漏或陈旧条目。`doctor` SHALL 能报告主 SKILL.md 或必需 reference 缺失。

#### Scenario: 安装带 references 的 skill
- **WHEN** 用户安装包含 review-code references 的版本
- **THEN** 安装目录同时包含 `SKILL.md` 与完整 `references/`，且主文件中的相对引用可解析

#### Scenario: doctor 发现 reference 缺失
- **WHEN** 安装目录存在主 SKILL.md 但缺少必需 reference
- **THEN** doctor 报告结构性缺失并给出重装建议
